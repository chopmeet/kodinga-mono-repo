import pytest
from django.core import mail

from apps.accounts.models.token import AuthToken
from apps.accounts.models.user import User
from apps.accounts.services.authentication import AuthenticationService
from apps.accounts.services.password import PasswordChangeService, PasswordResetService
from apps.accounts.services.registration import RegistrationService
from apps.accounts.services.verification import EmailVerificationService
from common.exceptions.handler import ApplicationError
from common.services.email_service import EmailService
from common.utils.tokens import hash_token


@pytest.mark.django_db
class TestAuthServices:
    def test_registration_service(self):
        user = RegistrationService.register_user(
            email="newdev@kodinga.com",
            username="newdev",
            password="StrongPassword123!",
            first_name="Alice",
            last_name="Tech"
        )
        assert user.email == "newdev@kodinga.com"
        assert user.is_email_verified is False
        assert AuthToken.objects.filter(
            user=user, purpose=AuthToken.PURPOSE_EMAIL_VERIFICATION
        ).exists()

    def test_authentication_service_success_and_failure(self):
        user = User.objects.create_user(
            email="auth_test@kodinga.com",
            username="authtest",
            password="ValidPassword123!"
        )

        # Success
        result = AuthenticationService.login_user(
            email="auth_test@kodinga.com",
            password="ValidPassword123!",
            device_name="TestDevice"
        )
        assert 'access' in result
        assert 'refresh' in result
        assert result['user'] == user

        # Invalid password
        with pytest.raises(ApplicationError) as exc_info:
            AuthenticationService.login_user(
                email="auth_test@kodinga.com",
                password="WrongPassword123!"
            )
        assert exc_info.value.code == "invalid_credentials"

    def test_email_verification_service(self):
        user = User.objects.create_user(
            email="verify_test@kodinga.com",
            username="verifytest",
            password="ValidPassword123!"
        )
        raw_token = "valid_test_token_string_12345"
        token_hash = hash_token(raw_token)
        from datetime import timedelta

        from django.utils import timezone
        AuthToken.objects.create(
            user=user,
            purpose=AuthToken.PURPOSE_EMAIL_VERIFICATION,
            token_hash=token_hash,
            expires_at=timezone.now() + timedelta(hours=24)
        )

        verified_user = EmailVerificationService.verify_email(raw_token)
        assert verified_user.is_email_verified is True

        # Re-using the same token should fail
        with pytest.raises(ApplicationError):
            EmailVerificationService.verify_email(raw_token)

    def test_password_reset_and_change_services(self):
        user = User.objects.create_user(
            email="pwd_test@kodinga.com",
            username="pwdtest",
            password="OldPassword123!"
        )

        PasswordResetService.request_password_reset(user.email)
        token_obj = AuthToken.objects.filter(
            user=user, purpose=AuthToken.PURPOSE_PASSWORD_RESET
        ).first()
        assert token_obj is not None

        # Manually create a raw token and hash for confirmation test
        raw_reset_token = "raw_reset_token_secret_1234"
        token_obj.token_hash = hash_token(raw_reset_token)
        token_obj.save()

        PasswordResetService.confirm_password_reset(
            raw_reset_token, "NewSecurePassword456!"
        )
        user.refresh_from_db()
        assert user.check_password("NewSecurePassword456!")

        # Password change
        PasswordChangeService.change_password(user, "AnotherPassword789!")
        user.refresh_from_db()
        assert user.check_password("AnotherPassword789!")

    def test_email_service_rendering(self):
        EmailService.send_mail(
            to_email="test@kodinga.com",
            subject="Test Subject",
            template_name="welcome",
            context={"first_name": "Tester", "username": "tester"}
        )
        assert len(mail.outbox) > 0
        assert "Test Subject" in mail.outbox[0].subject
