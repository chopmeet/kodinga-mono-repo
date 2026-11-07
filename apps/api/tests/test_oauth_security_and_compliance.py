from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.consent import UserConsent
from apps.accounts.models.oauth import OAuthIdentity
from apps.accounts.models.session import UserSession
from apps.accounts.models.user import User
from apps.accounts.services.oauth import OAuthService
from apps.ai.models.embedding import ContentEmbedding
from apps.classroom.models.course import Course
from apps.classroom.models.lesson import Lesson
from apps.classroom.models.module import CourseModule
from apps.communities.models.community import Community, CommunityPrivacy
from apps.memberships.models.member import CommunityMember, CommunityRole, MembershipStatus
from common.exceptions.handler import ApplicationError


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
class TestOAuthSecurityA1A3AndCompliance:
    def test_a1_existing_user_with_unverified_oauth_email_rejected(self):
        victim = User.objects.create_user(
            email="victim@kodinga.com",
            username="victim_user",
            password="StrongPassword123!",
        )

        fake_profile = {
            "provider_user_id": "google_123456",
            "email": "victim@kodinga.com",
            "first_name": "Attacker",
            "last_name": "Fraud",
            "email_verified": False,  # Provider cannot verify this email!
        }

        with patch.object(OAuthService, "exchange_google_code", return_value=fake_profile):
            with pytest.raises(ApplicationError) as exc_info:
                OAuthService.handle_callback(
                    provider=OAuthIdentity.PROVIDER_GOOGLE,
                    code="fake_auth_code",
                )
            assert exc_info.value.code == "oauth_email_not_verified"
            assert not OAuthIdentity.objects.filter(user=victim).exists()

    def test_a3_precreated_unverified_account_invalidates_password_and_sessions_on_oauth_link(self):
        user = User.objects.create_user(
            email="legit@kodinga.com",
            username="legit_user",
            password="PrecreatedPassword123!",
            email_verified_at=None,  # Not verified yet
        )
        assert user.has_usable_password()

        from datetime import timedelta
        from django.utils import timezone

        session = UserSession.objects.create(
            user=user,
            session_identifier="session_to_revoke",
            refresh_token_identifier="refresh_to_revoke",
            expires_at=timezone.now() + timedelta(days=7),
        )

        fake_profile = {
            "provider_user_id": "google_987654",
            "email": "legit@kodinga.com",
            "first_name": "Legit",
            "last_name": "User",
            "email_verified": True,
        }

        with patch.object(OAuthService, "exchange_google_code", return_value=fake_profile):
            result = OAuthService.handle_callback(
                provider=OAuthIdentity.PROVIDER_GOOGLE,
                code="fake_code_123",
            )
            assert result["user"].id == user.id

            user.refresh_from_db()
            assert not user.has_usable_password()
            assert user.email_verified_at is not None

            session.refresh_from_db()
            assert session.revoked_at is not None
            assert session.is_active is False

    def test_e1_new_oauth_user_records_tos_consent(self):
        fake_profile = {
            "provider_user_id": "google_newbie_01",
            "email": "newbie@kodinga.com",
            "first_name": "New",
            "last_name": "Developer",
            "email_verified": True,
        }

        with patch.object(OAuthService, "exchange_google_code", return_value=fake_profile):
            result = OAuthService.handle_callback(
                provider=OAuthIdentity.PROVIDER_GOOGLE,
                code="auth_code_newbie",
            )
            new_user = result["user"]
            assert UserConsent.objects.filter(
                user=new_user,
                consent_type="terms_of_service",
                granted=True,
            ).exists()

    def test_e2_oauth_state_validated_and_consumed(self):
        state = "secure_random_state_123"
        cache.set(f"oauth_state:{state}", {"redirect_uri": "http://localhost:3000/auth/callback/google"}, timeout=900)

        fake_profile = {
            "provider_user_id": "google_state_check",
            "email": "state_check@kodinga.com",
            "first_name": "State",
            "last_name": "Check",
            "email_verified": True,
        }

        with patch.object(OAuthService, "exchange_google_code", return_value=fake_profile):
            OAuthService.handle_callback(
                provider=OAuthIdentity.PROVIDER_GOOGLE,
                code="code_state_valid",
                state=state,
            )
            # Consumed state must be deleted from cache
            assert cache.get(f"oauth_state:{state}") is None

            # Replaying with same state must fail
            with pytest.raises(ApplicationError) as exc_info:
                OAuthService.handle_callback(
                    provider=OAuthIdentity.PROVIDER_GOOGLE,
                    code="code_state_replay",
                    state=state,
                )
            assert exc_info.value.code == "oauth_invalid_state"

    def test_e4_oauth_missing_client_id_raises_not_configured(self, settings):
        settings.GOOGLE_CLIENT_ID = ""
        with pytest.raises(ApplicationError) as exc_info:
            OAuthService.get_authorization_url(OAuthIdentity.PROVIDER_GOOGLE)
        assert exc_info.value.code == "oauth_not_configured"

    def test_e5_oauth_login_updates_last_login_and_jwt_claims(self):
        user = User.objects.create_user(
            email="claims_test@kodinga.com",
            username="claims_user",
            password="StrongPassword123!",
            email_verified_at=None,
        )
        fake_profile = {
            "provider_user_id": "google_claims_999",
            "email": "claims_test@kodinga.com",
            "first_name": "Claims",
            "last_name": "Test",
            "email_verified": True,
        }

        with patch.object(OAuthService, "exchange_google_code", return_value=fake_profile):
            result = OAuthService.handle_callback(
                provider=OAuthIdentity.PROVIDER_GOOGLE,
                code="code_claims",
            )
            user.refresh_from_db()
            assert user.last_login is not None
            assert "refresh" in result
            assert "access" in result


@pytest.mark.django_db
class TestSearchSecurityA4:
    def test_a4_private_community_search_rejected_for_non_members(self, api_client):
        owner = User.objects.create_user(email="owner_priv@kodinga.com", username="owner_priv", password="password")
        comm = Community.objects.create(name="Private Hub", slug="private-hub", owner=owner, privacy_type=CommunityPrivacy.PRIVATE)

        non_member = User.objects.create_user(email="intruder@kodinga.com", username="intruder", password="password")
        api_client.force_authenticate(user=non_member)

        # 1. Semantic search
        res = api_client.post(f"/api/v1/communities/{comm.slug}/ai/semantic-search/", {"query": "secret roadmap"}, format="json")
        assert res.status_code == status.HTTP_403_FORBIDDEN

        # 2. Check duplicates
        res_dup = api_client.post(f"/api/v1/communities/{comm.slug}/ai/check-duplicates/", {"title": "secret question"}, format="json")
        assert res_dup.status_code == status.HTTP_403_FORBIDDEN

    def test_a4_semantic_search_filters_out_unpublished_course_lessons(self, api_client):
        owner = User.objects.create_user(email="owner_pub@kodinga.com", username="owner_pub", password="password")
        comm = Community.objects.create(name="Public Hub", slug="public-hub", owner=owner, privacy_type=CommunityPrivacy.PUBLIC)
        CommunityMember.objects.create(community=comm, user=owner, role=CommunityRole.OWNER, status=MembershipStatus.ACTIVE)

        unpub_course = Course.objects.create(community=comm, title="Draft Course", slug="draft-course", is_published=False)
        module = CourseModule.objects.create(course=unpub_course, title="Module 1", order=1)
        lesson = Lesson.objects.create(module=module, title="Confidential Architecture Lesson", content="Private details")

        # Create embedding for this lesson
        ContentEmbedding.objects.create(
            community=comm,
            content_type="lesson",
            object_id=str(lesson.id),
            title="Confidential Architecture Lesson",
            embedding=[0.1] * 128,
            metadata={"course_id": str(unpub_course.id), "url": f"/communities/{comm.slug}/courses/{unpub_course.slug}?lesson={lesson.id}"},
        )

        api_client.force_authenticate(user=owner)
        with patch("apps.ai.router.ai_router.generate_embedding", return_value=[0.1] * 128):
            res = api_client.post(f"/api/v1/communities/{comm.slug}/ai/semantic-search/", {"query": "Architecture"}, format="json")
            assert res.status_code == status.HTTP_200_OK
            results = res.data.get("results", [])
            # Unpublished course lesson must be filtered out
            assert len(results) == 0
