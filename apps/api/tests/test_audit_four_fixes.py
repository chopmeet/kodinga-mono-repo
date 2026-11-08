from datetime import timedelta
from unittest.mock import patch

import pytest
from django.conf import settings
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.oauth import OAuthIdentity
from apps.accounts.models.user import User
from apps.accounts.services.oauth import OAuthService
from apps.communities.models.community import Community, CommunityPrivacy
from apps.communities.models.settings import CommunitySettings
from apps.events.models.attendee import AttendeeStatus, EventAttendee
from apps.events.models.event import Event, EventFormat, EventStatus
from apps.events.tasks import send_event_reminders_task
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.notifications.models.notification import Notification
from apps.profiles.models.follow import UserFollow
from apps.profiles.models.profile import DeveloperProfile
from common.exceptions.handler import ApplicationError


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_target(db):
    user = User.objects.create_user(
        email="target@kodinga.com",
        username="target_dev",
        first_name="Target",
        last_name="Developer",
        password="Password123!",
    )
    DeveloperProfile.objects.get_or_create(user=user, defaults={"bio": "Target bio"})
    return user


@pytest.fixture
def user_viewer(db):
    user = User.objects.create_user(
        email="viewer@kodinga.com",
        username="viewer_dev",
        first_name="Viewer",
        last_name="Developer",
        password="Password123!",
    )
    DeveloperProfile.objects.get_or_create(user=user, defaults={"bio": "Viewer bio"})
    return user


@pytest.fixture
def community(db, user_target):
    comm = Community.objects.create(
        name="Tech Senegal",
        slug="tech-senegal",
        owner=user_target,
        privacy_type=CommunityPrivacy.PUBLIC,
    )
    CommunityMember.objects.create(
        community=comm,
        user=user_target,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    CommunitySettings.objects.get_or_create(community=comm)
    return comm


@pytest.mark.django_db
class TestAuditFourFixes:
    """
    Validation tests for the 4 frontend audit feedback points:
    1. Follow button context in DeveloperProfileDetailSerializer
    2. Member directory authorization checking can_sanction_members
    3. Event reminder links targeting /c/<slug>/events/<event_slug>
    4. Mandatory OAuth state validated before any external network exchange
    """

    # --- 1. Follow Button (is_following) ---
    def test_point1_profile_detail_is_following_true_when_viewer_follows(
        self, api_client, user_target, user_viewer
    ):
        UserFollow.objects.create(follower=user_viewer, following=user_target)

        # Authenticated as user_viewer
        api_client.force_authenticate(user=user_viewer)
        res = api_client.get(f"/api/v1/profiles/@{user_target.username}/")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["data"]["is_following"] is True

    def test_point1_profile_detail_is_following_false_when_not_following_or_anonymous(
        self, api_client, user_target, user_viewer
    ):
        # Authenticated as viewer, but not following
        api_client.force_authenticate(user=user_viewer)
        res = api_client.get(f"/api/v1/profiles/@{user_target.username}/")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["data"]["is_following"] is False

        # Anonymous client
        api_client.force_authenticate(user=None)
        res_anon = api_client.get(f"/api/v1/profiles/@{user_target.username}/")
        assert res_anon.status_code == status.HTTP_200_OK
        assert res_anon.data["data"]["is_following"] is False

    # --- 2. Sanction Permission in Member Directory ---
    def test_point2_member_directory_allows_moderator_role_and_sanction_permission(
        self, api_client, community, user_viewer
    ):
        # Add viewer as a moderator with ACTIVE status
        CommunityMember.objects.create(
            community=community,
            user=user_viewer,
            role=CommunityRole.MODERATOR,
            status=MembershipStatus.ACTIVE,
        )

        api_client.force_authenticate(user=user_viewer)
        res = api_client.get(f"/api/v1/communities/{community.slug}/members/")
        assert res.status_code == status.HTTP_200_OK

    # --- 3. Event Reminder Notification & Email URLs ---
    def test_point3_event_reminder_urls_target_specific_event(
        self, community, user_target, user_viewer
    ):
        now = timezone.now()
        event = Event.objects.create(
            community=community,
            host=user_target,
            title="Kodinga Masterclass 2026",
            slug="kodinga-masterclass-2026",
            start_time=now + timedelta(minutes=15),
            end_time=now + timedelta(hours=2),
            format=EventFormat.LIVEKIT,
            status=EventStatus.SCHEDULED,
            timezone="Africa/Dakar",
        )
        EventAttendee.objects.create(
            event=event,
            user=user_viewer,
            status=AttendeeStatus.ATTENDING,
            reminder_sent=False,
        )

        with patch("apps.events.tasks.EmailService.send_mail") as mock_email:
            sent_count = send_event_reminders_task(minutes_before=30)
            assert sent_count == 1

            # 1. In-app notification action_url
            notif = Notification.objects.filter(
                recipient=user_viewer, target_type="event"
            ).first()
            assert notif is not None
            expected_path = f"/c/{community.slug}/events/{event.slug}"
            assert notif.action_url == expected_path

            # 2. Email context event_url
            mock_email.assert_called_once()
            call_kwargs = mock_email.call_args.kwargs
            frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
            expected_event_url = (
                f"{frontend_url}/c/{community.slug}/events/{event.slug}"
            )
            assert call_kwargs["context"]["event_url"] == expected_event_url

    # --- 4. OAuth State Requirement & Verification Prior to Exchange ---
    def test_point4_oauth_missing_state_rejected_by_serializer(self, api_client):
        url = reverse("accounts:oauth_callback", kwargs={"provider": "google"})
        res = api_client.post(
            url,
            {"code": "auth_code_123"},
            format="json",
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_point4_oauth_invalid_state_fails_before_calling_external_provider(self):
        with patch.object(OAuthService, "exchange_google_code") as mock_exchange:
            with pytest.raises(ApplicationError) as exc:
                OAuthService.handle_callback(
                    provider=OAuthIdentity.PROVIDER_GOOGLE,
                    code="code_123",
                    state="unknown_or_expired_state",
                )
            assert exc.value.code == "oauth_invalid_state"
            mock_exchange.assert_not_called()

    def test_point4_oauth_valid_state_is_consumed_and_blocks_replay(self):
        state = "secure_state_val_999"
        cache.set(
            f"oauth_state:{state}",
            {
                "redirect_uri": "http://localhost:3000/auth/callback/google",
                "provider": OAuthIdentity.PROVIDER_GOOGLE,
            },
            timeout=900,
        )

        fake_profile = {
            "provider_user_id": "google_uid_999",
            "email": "fresh_oauth@kodinga.com",
            "first_name": "Fresh",
            "last_name": "OAuth",
            "email_verified": True,
        }

        with patch.object(
            OAuthService, "exchange_google_code", return_value=fake_profile
        ) as mock_exchange:
            # First execution succeeds
            result = OAuthService.handle_callback(
                provider=OAuthIdentity.PROVIDER_GOOGLE,
                code="code_first_try",
                state=state,
            )
            assert result["user"].email == "fresh_oauth@kodinga.com"
            assert mock_exchange.call_count == 1

            # Second execution (replay) fails immediately without calling external provider again
            with pytest.raises(ApplicationError) as exc:
                OAuthService.handle_callback(
                    provider=OAuthIdentity.PROVIDER_GOOGLE,
                    code="code_replay_try",
                    state=state,
                )
            assert exc.value.code == "oauth_invalid_state"
            assert mock_exchange.call_count == 1  # Still 1, not called again!
