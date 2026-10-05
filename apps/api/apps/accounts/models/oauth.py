from django.conf import settings
from django.db import models
from common.models.base import BaseModel


class OAuthIdentity(BaseModel):
    """
    Represents a verified external OAuth provider connection for a user.
    """
    PROVIDER_GOOGLE = 'google'
    PROVIDER_GITHUB = 'github'

    PROVIDER_CHOICES = [
        (PROVIDER_GOOGLE, 'Google'),
        (PROVIDER_GITHUB, 'GitHub'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='oauth_identities',
        help_text="Linked user account."
    )
    provider = models.CharField(
        max_length=50,
        choices=PROVIDER_CHOICES,
        help_text="OAuth provider name."
    )
    provider_user_id = models.CharField(
        max_length=255,
        help_text="Provider's unique subject/user ID."
    )
    provider_email = models.CharField(
        max_length=255,
        blank=True,
        help_text="Email address received from provider."
    )

    class Meta:
        verbose_name = 'OAuth Identity'
        verbose_name_plural = 'OAuth Identities'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'provider_user_id'],
                name='unique_provider_user_id'
            ),
            models.UniqueConstraint(
                fields=['user', 'provider'],
                name='unique_user_provider'
            )
        ]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.provider} ({self.provider_user_id})"
