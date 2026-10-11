from datetime import timedelta
import logging
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from common.services.email_service import EmailService
from common.utils.tokens import generate_secure_token, hash_token
from apps.accounts.models.consent import UserConsent
from apps.accounts.models.token import AuthToken
from apps.accounts.models.user import User
from apps.accounts.services.consent import ConsentService
from apps.accounts.services.security import AccountSecurityService
from apps.accounts.tasks import send_email_async_task

logger = logging.getLogger('kodinga.accounts')


class RegistrationService:
    """
    Handles user registration workflow, consent persistence, single-use email verification
    token creation and transactional email scheduling with delivery notification logging.
    """

    @classmethod
    def register_user(
        cls,
        email: str,
        username: str,
        password: str,
        first_name: str = "",
        last_name: str = "",
        preferred_language: str = "fr",
        timezone_name: str = "UTC",
        terms_accepted: bool = True,
        request=None
    ) -> User:
        with transaction.atomic():
            user = User.objects.create_user(
                email=email,
                username=username,
                password=password,
                first_name=first_name,
                last_name=last_name,
                preferred_language=preferred_language,
                timezone=timezone_name
            )

            # Record RGPD / CGU consent
            if terms_accepted:
                ConsentService.record_consent(
                    user=user,
                    consent_type=UserConsent.CONSENT_TOS if hasattr(UserConsent, 'CONSENT_TOS') else 'terms_of_service',
                    policy_version="1.0",
                    granted=True
                )

            # Generate raw token and store hash
            raw_token = generate_secure_token(32)
            token_hash = hash_token(raw_token)
            expires_at = timezone.now() + timedelta(hours=24)

            AuthToken.objects.create(
                user=user,
                purpose=AuthToken.PURPOSE_EMAIL_VERIFICATION,
                token_hash=token_hash,
                expires_at=expires_at
            )

            # Audit registration event
            AccountSecurityService.log_event(
                user=user,
                event_type='user_registered',
                request=request,
                metadata={'email': user.email, 'username': user.username}
            )

            # Prepare verification email
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            verification_url = f"{frontend_url}/auth/verify-email?token={raw_token}"
            email_context = {
                'first_name': user.first_name,
                'username': user.username,
                'verification_url': verification_url,
                'expires_in_minutes': 1440,
            }

            if getattr(settings, 'DEBUG', False):
                print(f"\n[DEBUG EMAIL VERIFICATION LINK for {user.email}]: {verification_url}\n")

            def queue_email():
                try:
                    sent = EmailService.send_mail(
                        to_email=user.email,
                        subject=f"Bienvenue sur {getattr(settings, 'APP_NAME', 'Kodinga')} - Confirmez votre adresse email",
                        template_name='verification',
                        context=email_context,
                        fail_silently=False
                    )
                    if sent:
                        AccountSecurityService.log_event(
                            user=user,
                            event_type='email_dispatch_success',
                            request=request,
                            metadata={'purpose': 'email_verification', 'email': user.email}
                        )
                except Exception as exc:
                    logger.error(f"Failed to dispatch verification email to {user.email}: {exc}")
                    AccountSecurityService.log_event(
                        user=user,
                        event_type='email_dispatch_failed',
                        request=request,
                        metadata={
                            'purpose': 'email_verification',
                            'email': user.email,
                            'error': str(exc)
                        }
                    )

            transaction.on_commit(queue_email)

            return user
