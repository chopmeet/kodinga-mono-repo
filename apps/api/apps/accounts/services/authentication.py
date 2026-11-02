from typing import Any

from apps.accounts.models.user import User
from apps.accounts.services.security import AccountSecurityService
from apps.accounts.services.session import SessionService
from common.exceptions.handler import ApplicationError
from django.contrib.auth.models import update_last_login
from rest_framework_simplejwt.tokens import RefreshToken


class AuthenticationService:
    """
    Handles user login, credential verification, JWT token issuance, session tracking,
    and security auditing.
    """

    @classmethod
    def login_user(
        cls,
        email: str,
        password: str,
        request=None,
        device_name: str = ""
    ) -> dict[str, Any]:
        identifier = email.strip()
        user = (
            User.objects.filter(email__iexact=identifier).first()
            or User.objects.filter(username__iexact=identifier).first()
        )

        if user is None or not user.check_password(password):
            AccountSecurityService.log_event(
                event_type='login_failed',
                user=user,
                request=request,
                metadata={'attempted_identifier': identifier}
            )
            raise ApplicationError(
                message="Invalid email or password.",
                code="invalid_credentials",
                status_code=401
            )

        if not user.is_active:
            AccountSecurityService.log_event(
                event_type='login_failed_inactive_account',
                user=user,
                request=request
            )
            raise ApplicationError(
                message="This user account has been disabled.",
                code="account_inactive",
                status_code=403
            )

        update_last_login(None, user)

        # Generate JWT Tokens
        refresh = RefreshToken.for_user(user)
        refresh['username'] = user.username
        refresh['email'] = user.email

        # Create active session
        session = SessionService.create_session(
            user=user,
            refresh_token_str=str(refresh),
            request=request,
            device_name=device_name
        )

        # Log security audit
        AccountSecurityService.log_event(
            event_type='login_success',
            user=user,
            request=request,
            metadata={'session_id': str(session.id)}
        )

        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': user,
            'session_id': str(session.id),
        }
