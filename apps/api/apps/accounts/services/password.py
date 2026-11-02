import logging
from datetime import timedelta

from apps.accounts.models.token import AuthToken
from apps.accounts.models.user import User
from apps.accounts.services.security import AccountSecurityService
from apps.accounts.services.session import SessionService
from common.exceptions.handler import ApplicationError
from common.services.email_service import EmailService
from common.utils.tokens import generate_secure_token, hash_token
from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger('kodinga.auth')


class PasswordResetService:
    """
    Manages secure password reset requests and confirmations.
    """

    @classmethod
    def request_password_reset(cls, email: str, request=None) -> dict:
        identifier = email.strip()
        print("\n==================================================", flush=True)
        print(f"[PASSWORD RESET] Requete recue pour : '{identifier}'", flush=True)

        user = (
            User.objects.filter(email__iexact=identifier, is_active=True).first()
            or User.objects.filter(username__iexact=identifier, is_active=True).first()
        )

        # Always return generic success to prevent account enumeration
        if not user:
            logger.info(f"Password reset requested for non-existent or inactive identifier: {identifier}")
            print(f"[PASSWORD RESET NOTICE] Aucun compte actif trouve avec l'identifiant: '{identifier}'.", flush=True)
            print("[RESEND] AUCUN EMAIL ENVOYE (Compte inexistant dans la base de donnees).", flush=True)
            print("==================================================\n", flush=True)
            return {"status": "not_found", "email": identifier}

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

            print(f"[DEBUG PASSWORD RESET LINK for {user.email}]: {reset_url}", flush=True)

        # Dispatch email directly for immediate response and console feedback
        dispatch_result = None
        try:
            dispatch_result = EmailService.send_mail(
                to_email=user.email,
                subject=f"Réinitialisation de votre mot de passe - {getattr(settings, 'APP_NAME', 'Kodinga')}",
                template_name='password_reset',
                context=email_context,
                fail_silently=False
            )
            AccountSecurityService.log_event(
                user=user,
                event_type='email_dispatch_success',
                request=request,
                metadata={'purpose': 'password_reset', 'email': user.email}
            )
        except Exception as exc:
            logger.error(f"Failed to dispatch password reset email to {user.email}: {exc}")
            print(f"[PASSWORD RESET ERROR]: {exc}", flush=True)
            AccountSecurityService.log_event(
                user=user,
                event_type='email_dispatch_failed',
                request=request,
                metadata={'purpose': 'password_reset', 'email': user.email, 'error': str(exc)}
            )

        resend_id = dispatch_result.get("id") if isinstance(dispatch_result, dict) else None
        return {
            "status": "sent",
            "email": user.email,
            "resend_id": resend_id,
            "reset_link": reset_url,
        }

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
                        fail_silently=False
                    )
                except Exception as exc:
                    logger.error(f"Failed to dispatch password changed email to {user.email}: {exc}")

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
                        fail_silently=False
                    )
                except Exception as exc:
                    logger.error(f"Failed to dispatch password confirmation email to {user.email}: {exc}")

            transaction.on_commit(queue_confirmation)
