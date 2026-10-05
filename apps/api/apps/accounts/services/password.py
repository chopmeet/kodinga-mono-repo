from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from common.exceptions.handler import ApplicationError
from common.services.email_service import EmailService
from common.utils.tokens import generate_secure_token, hash_token
from apps.accounts.models.token import AuthToken
from apps.accounts.models.user import User
from apps.accounts.services.security import AccountSecurityService
from apps.accounts.services.session import SessionService


class PasswordResetService:
    """
    Manages secure password reset requests and confirmations.
    """

    @classmethod
    def request_password_reset(cls, email: str, request=None) -> None:
        normalized_email = email.strip().lower()
        user = User.objects.filter(email=normalized_email, is_active=True).first()

        # Always return generic success to prevent account enumeration
        if not user:
            return

        with transaction.atomic():
            # Invalidate older pending password reset tokens
            AuthToken.objects.filter(
                user=user,
                purpose=AuthToken.PURPOSE_PASSWORD_RESET,
                consumed_at__isnull=True
            ).update(consumed_at=timezone.now())

            raw_token = generate_secure_token(32)
            token_hash = hash_token(raw_token)
            expires_at = timezone.now() + timedelta(hours=1)

            AuthToken.objects.create(
                user=user,
                purpose=AuthToken.PURPOSE_PASSWORD_RESET,
                token_hash=token_hash,
                expires_at=expires_at
            )

            AccountSecurityService.log_event(
                event_type='password_reset_requested',
                user=user,
                request=request
            )

            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            reset_url = f"{frontend_url}/auth/reset-password?token={raw_token}"
            email_context = {
                'first_name': user.first_name,
                'username': user.username,
                'reset_url': reset_url,
                'expires_in_minutes': 60,
            }

            def queue_reset_email():
                try:
                    EmailService.send_mail(
                        to_email=user.email,
                        subject=f"Réinitialisation de votre mot de passe - {getattr(settings, 'APP_NAME', 'Kodinga')}",
                        template_name='password_reset',
                        context=email_context,
                        fail_silently=True
                    )
                except Exception:
                    pass

            transaction.on_commit(queue_reset_email)

    @classmethod
    def confirm_password_reset(cls, token_str: str, new_password: str, request=None) -> User:
        token_hash = hash_token(token_str)
        token = AuthToken.objects.filter(
            token_hash=token_hash,
            purpose=AuthToken.PURPOSE_PASSWORD_RESET
        ).select_related('user').first()

        if token is None or not token.is_valid:
            raise ApplicationError(
                message="Invalid or expired password reset link.",
                code="invalid_reset_token",
                status_code=400
            )

        user = token.user
        with transaction.atomic():
            user.set_password(new_password)
            user.save(update_fields=['password', 'updated_at'])
            token.consume()

            # Revoke all current sessions on password reset
            SessionService.revoke_all_sessions(user)

            AccountSecurityService.log_event(
                event_type='password_reset_completed',
                user=user,
                request=request
            )

            email_context = {
                'first_name': user.first_name,
                'username': user.username,
                'changed_at': timezone.now().strftime("%d/%m/%Y %H:%M UTC"),
            }

            def queue_confirmation():
                try:
                    EmailService.send_mail(
                        to_email=user.email,
                        subject=f"Votre mot de passe {getattr(settings, 'APP_NAME', 'Kodinga')} a été modifié",
                        template_name='password_changed',
                        context=email_context,
                        fail_silently=True
                    )
                except Exception:
                    pass

            transaction.on_commit(queue_confirmation)

        return user


class PasswordChangeService:
    """
    Handles authenticated password change workflows.
    """

    @classmethod
    def change_password(cls, user: User, new_password: str, request=None) -> None:
        with transaction.atomic():
            user.set_password(new_password)
            user.save(update_fields=['password', 'updated_at'])

            AccountSecurityService.log_event(
                event_type='password_changed',
                user=user,
                request=request
            )

            email_context = {
                'first_name': user.first_name,
                'username': user.username,
                'changed_at': timezone.now().strftime("%d/%m/%Y %H:%M UTC"),
            }

            def queue_confirmation():
                try:
                    EmailService.send_mail(
                        to_email=user.email,
                        subject=f"Confirmation de modification de mot de passe - {getattr(settings, 'APP_NAME', 'Kodinga')}",
                        template_name='password_changed',
                        context=email_context,
                        fail_silently=True
                    )
                except Exception:
                    pass

            transaction.on_commit(queue_confirmation)
