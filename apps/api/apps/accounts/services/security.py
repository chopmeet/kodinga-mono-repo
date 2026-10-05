from typing import Any, Dict, Optional
from django.conf import settings
from apps.accounts.models.security import SecurityEvent


class AccountSecurityService:
    @staticmethod
    def get_client_ip(request) -> Optional[str]:
        if not request:
            return None
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    @staticmethod
    def get_client_user_agent(request) -> str:
        if not request:
            return ""
        return request.META.get('HTTP_USER_AGENT', '')[:500]

    @classmethod
    def log_event(
        cls,
        event_type: str,
        user=None,
        request=None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> SecurityEvent:
        ip = cls.get_client_ip(request)
        ua = cls.get_client_user_agent(request)
        return SecurityEvent.objects.create(
            user=user,
            event_type=event_type,
            ip_address=ip,
            user_agent=ua,
            metadata=metadata or {}
        )
