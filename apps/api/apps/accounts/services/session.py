from datetime import datetime, timezone as dt_timezone
import uuid
from django.conf import settings
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from common.exceptions.handler import ResourceNotFoundError
from apps.accounts.models.session import UserSession
from apps.accounts.services.security import AccountSecurityService


class SessionService:
    """
    Manages active user sessions, refresh token correlation, and revocation.
    """

    @classmethod
    def create_session(
        cls,
        user,
        refresh_token_str: str,
        request=None,
        device_name: str = ""
    ) -> UserSession:
        refresh = RefreshToken(refresh_token_str)
        jti = refresh.get('jti')
        exp = refresh.get('exp')
        expires_at = datetime.fromtimestamp(exp, tz=dt_timezone.utc) if exp else timezone.now() + timezone.timedelta(days=7)

        ip = AccountSecurityService.get_client_ip(request)
        ua = AccountSecurityService.get_client_user_agent(request)
        final_device = device_name or (ua[:50] if ua else "Unknown device")

        session_id = str(uuid.uuid4())

        session = UserSession.objects.create(
            user=user,
            session_identifier=session_id,
            refresh_token_identifier=jti,
            device_name=final_device,
            user_agent=ua,
            ip_address=ip,
            expires_at=expires_at
        )
        return session

    @classmethod
    def list_active_sessions(cls, user):
        return UserSession.objects.filter(
            user=user,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now()
        ).order_by('-last_seen_at')

    @classmethod
    def revoke_session(cls, user, session_id: str) -> None:
        try:
            session = UserSession.objects.get(user=user, id=session_id)
        except UserSession.DoesNotExist:
            raise ResourceNotFoundError("Session not found.")

        session.revoke()

        # Blacklist associated token if recorded in OutstandingToken
        try:
            outstanding = OutstandingToken.objects.filter(jti=session.refresh_token_identifier).first()
            if outstanding and not BlacklistedToken.objects.filter(token=outstanding).exists():
                BlacklistedToken.objects.create(token=outstanding)
        except Exception:
            pass

    @classmethod
    def revoke_all_sessions(cls, user, except_session_id: str = None) -> int:
        sessions = UserSession.objects.filter(
            user=user,
            revoked_at__isnull=True
        )
        if except_session_id:
            sessions = sessions.exclude(id=except_session_id)

        count = 0
        now = timezone.now()
        for session in sessions:
            session.revoked_at = now
            session.save(update_fields=['revoked_at', 'updated_at'])
            count += 1
            try:
                outstanding = OutstandingToken.objects.filter(jti=session.refresh_token_identifier).first()
                if outstanding and not BlacklistedToken.objects.filter(token=outstanding).exists():
                    BlacklistedToken.objects.create(token=outstanding)
            except Exception:
                pass
        return count
