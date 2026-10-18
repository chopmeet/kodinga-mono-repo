import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.accounts.models.token import AuthToken
from apps.accounts.models.user import User
from apps.accounts.services.security import AccountSecurityService
from common.exceptions.handler import ApplicationError
from common.services.email_service import EmailService
from common.utils.tokens import generate_secure_token, hash_token

logger = logging.getLogger('kodinga.accounts')


class EmailVerificationService:
    """
    Handles single-use token email confirmation and anti-abuse resend workflows.
    """

    @classmethod
    def verify_email(cls, token_str: str, request=None) -> User:
        token_hash = hash_token(token_str)
        token = AuthToken.objects.filter(
            token_hash=token_hash,
            purpose=AuthToken.PURPOSE_EMAIL_VERIFICATION
        ).select_related('user').first()

        if token is None or not token.is_valid:
            raise ApplicationError(
                message="Invalid or expired email verification link.",
                code="invalid_verification_token",
                status_code=400
            )

        user = token.user
        with transaction.atomic():
            user.mark_email_verified()
            token.consume()

            AccountSecurityService.log_event(
                event_type='email_verified',
                user=user,
                request=request
            )

            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            welcome_context = {
                'first_name': user.first_name,
                'username': user.username,
                'frontend_url': frontend_url,
            }

            def queue_welcome():
                try:
                    sent = EmailService.send_mail(
                        to_email=user.email,
                        subject=f"Votre compte {getattr(settings, 'APP_NAME', 'Kodinga')} est activé !",
                        template_name='welcome',
                        context=welcome_context,
                        fail_silently=False
                    )
                    if sent:
                        AccountSecurityService.log_event(
                            user=user,
                            event_type='email_dispatch_success',
                            request=request,
                            metadata={'purpose': 'welcome_email', 'email': user.email}
                        )
                except Exception as exc:
                    logger.error(f"Failed to send welcome email to {user.email}: {exc}")
                    AccountSecurityService.log_event(
                        user=user,
                        event_type='email_dispatch_failed',
                        request=request,
                        metadata={'purpose': 'welcome_email', 'email': user.email, 'error': str(exc)}
                    )

            transaction.on_commit(queue_welcome)

        return user

    @classmethod
    def resend_verification_email(cls, email: str, request=None) -> None:
        normalized_email = email.strip().lower()
        user = User.objects.filter(email=normalized_email).first()

        # Generic response returned to prevent account enumeration
        if not user or user.is_email_verified:
            return

        with transaction.atomic():
            # Invalidate older non-consumed verification tokens
            AuthToken.objects.filter(
                user=user,
                purpose=AuthToken.PURPOSE_EMAIL_VERIFICATION,
                consumed_at__isnull=True
            ).update(consumed_at=timezone.now())

            raw_token = generate_secure_token(32)
            token_hash = hash_token(raw_token)
            expires_at = timezone.now() + timedelta(hours=24)

            AuthToken.objects.create(
                user=user,
                purpose=AuthToken.PURPOSE_EMAIL_VERIFICATION,
                token_hash=token_hash,
                expires_at=expires_at
            )

            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            verification_url = f"{frontend_url}/auth/verify-email?token={raw_token}"
            email_context = {
                'first_name': user.first_name,
                'username': user.username,
                'verification_url': verification_url,
                'expires_in_minutes': 1440,
            }

            if getattr(settings, 'DEBUG', False):
                print(f"\n[DEBUG RESEND VERIFICATION LINK for {user.email}]: {verification_url}\n")

            def queue_resend():
                try:
                    sent = EmailService.send_mail(
                        to_email=user.email,
                        subject=f"Vérifiez votre adresse email - {getattr(settings, 'APP_NAME', 'Kodinga')}",
                        template_name='verification',
                        context=email_context,
                        fail_silently=False
                    )
                    if sent:
                        AccountSecurityService.log_event(
                            user=user,
                            event_type='email_dispatch_success',
                            request=request,
                            metadata={'purpose': 'resend_verification', 'email': user.email}
                        )
                except Exception as exc:
                    logger.error(f"Failed to resend verification email to {user.email}: {exc}")
                    AccountSecurityService.log_event(
                        user=user,
                        event_type='email_dispatch_failed',
                        request=request,
                        metadata={'purpose': 'resend_verification', 'email': user.email, 'error': str(exc)}
                    )

            transaction.on_commit(queue_resend)
