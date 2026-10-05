from datetime import timedelta
import pytest
from django.utils import timezone
from apps.accounts.models.consent import UserConsent
from apps.accounts.models.oauth import OAuthIdentity
from apps.accounts.models.security import SecurityEvent
from apps.accounts.models.session import UserSession
from apps.accounts.models.token import AuthToken
from apps.accounts.models.user import User


@pytest.mark.django_db
class TestUserModel:
    def test_create_user_success(self):
        user = User.objects.create_user(
            email="DEV@Kodinga.com",
            username="TechDev",
            password="SecurePassword123!",
            first_name="Jean",
            last_name="Dupont"
        )
        assert user.email == "dev@kodinga.com"
        assert user.username == "techdev"
        assert user.check_password("SecurePassword123!")
        assert user.is_active is True
        assert user.is_staff is False
        assert user.is_superuser is False
        assert user.is_email_verified is False
        assert user.get_full_name() == "Jean Dupont"

    def test_create_superuser(self):
        admin = User.objects.create_superuser(
            email="admin@kodinga.com",
            username="admin",
            password="AdminPassword123!"
        )
        assert admin.is_staff is True
        assert admin.is_superuser is True
        assert admin.is_email_verified is True

    def test_user_session_model(self):
        user = User.objects.create_user(
            email="user_sess@kodinga.com",
            username="usersess",
            password="Password123!"
        )
        session = UserSession.objects.create(
            user=user,
            session_identifier="sess_123",
            refresh_token_identifier="jti_456",
            device_name="Chrome MacOS",
            expires_at=timezone.now() + timedelta(days=7)
        )
        assert session.is_active is True
        session.revoke()
        assert session.is_active is False
        assert session.revoked_at is not None

    def test_auth_token_model(self):
        user = User.objects.create_user(
            email="tok@kodinga.com",
            username="usertok",
            password="Password123!"
        )
        token = AuthToken.objects.create(
            user=user,
            purpose=AuthToken.PURPOSE_EMAIL_VERIFICATION,
            token_hash="fakehash123",
            expires_at=timezone.now() + timedelta(hours=1)
        )
        assert token.is_valid is True
        token.consume()
        assert token.is_valid is False
        assert token.consumed_at is not None

    def test_oauth_identity_and_consent(self):
        user = User.objects.create_user(
            email="oauth_user@kodinga.com",
            username="oauthuser",
            password="Password123!"
        )
        identity = OAuthIdentity.objects.create(
            user=user,
            provider=OAuthIdentity.PROVIDER_GITHUB,
            provider_user_id="12345678",
            provider_email="oauth_user@kodinga.com"
        )
        assert identity.provider == "github"

        consent = UserConsent.objects.create(
            user=user,
            consent_type="terms_of_service",
            policy_version="1.0",
            granted=True
        )
        assert consent.granted is True

        event = SecurityEvent.objects.create(
            user=user,
            event_type="login_success",
            ip_address="127.0.0.1"
        )
        assert event.event_type == "login_success"
