from common.models.base import BaseModel
from django.conf import settings
from django.db import models


class SecurityEvent(BaseModel):
    """
    Audit log for critical security events on user accounts.
    """
    EVENT_LOGIN_SUCCESS = 'login_success'
    EVENT_LOGIN_FAILED = 'login_failed'
    EVENT_LOGOUT = 'logout'
    EVENT_LOGOUT_ALL = 'logout_all'
    EVENT_PASSWORD_CHANGED = 'password_changed'
    EVENT_PASSWORD_RESET_REQUESTED = 'password_reset_requested'
    EVENT_PASSWORD_RESET_COMPLETED = 'password_reset_completed'
    EVENT_EMAIL_VERIFIED = 'email_verified'
    EVENT_SESSION_REVOKED = 'session_revoked'
    EVENT_OAUTH_LINKED = 'oauth_linked'
    EVENT_SUSPICIOUS_ACTIVITY = 'suspicious_activity'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='security_events',
        help_text="Target user if resolved."
    )
    event_type = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Security event type code."
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="Source IP address."
    )
    user_agent = models.TextField(
        blank=True,
        help_text="Source client user-agent."
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured event metadata (excluding credentials/secrets)."
    )

    class Meta:
        verbose_name = 'Security Event'
        verbose_name_plural = 'Security Events'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['event_type', 'created_at']),
        ]

    def __str__(self) -> str:
        username = self.user.username if self.user else "Anonymous"
        return f"[{self.event_type}] by {username} at {self.created_at}"
