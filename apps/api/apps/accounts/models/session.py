from django.conf import settings
from django.db import models
from django.utils import timezone
from common.models.base import BaseModel


class UserSession(BaseModel):
    """
    Tracks active client/device sessions, refresh tokens and revocation state.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sessions',
        help_text="User owning this session."
    )
    session_identifier = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="Unique session identifier / JTI correlation."
    )
    refresh_token_identifier = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="JTI hash of the current active refresh token."
    )
    device_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Device name or parsed user-agent header."
    )
    user_agent = models.TextField(
        blank=True,
        help_text="Raw client User-Agent string."
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="Client IP address recorded during session creation/access."
    )
    last_seen_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when the session was last active."
    )
    expires_at = models.DateTimeField(
        help_text="Timestamp when the refresh token / session expires."
    )
    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Timestamp when the session was explicitly revoked."
    )

    class Meta:
        verbose_name = 'User Session'
        verbose_name_plural = 'User Sessions'
        ordering = ['-last_seen_at']
        indexes = [
            models.Index(fields=['user', 'revoked_at']),
        ]

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None and self.expires_at > timezone.now()

    def revoke(self):
        if not self.revoked_at:
            self.revoked_at = timezone.now()
            self.save(update_fields=['revoked_at', 'updated_at'])

    def __str__(self) -> str:
        status = "Active" if self.is_active else "Revoked/Expired"
        return f"Session for {self.user.username} on {self.device_name or 'unknown'} ({status})"
