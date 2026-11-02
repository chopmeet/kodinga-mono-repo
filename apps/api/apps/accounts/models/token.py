from common.models.base import BaseModel
from django.conf import settings
from django.db import models
from django.utils import timezone


class AuthToken(BaseModel):
    """
    Secure single-use or time-bound cryptographic token hashes for sensitive flows.
    """
    PURPOSE_EMAIL_VERIFICATION = 'email_verification'
    PURPOSE_PASSWORD_RESET = 'password_reset'
    PURPOSE_EMAIL_CHANGE = 'email_change'
    PURPOSE_ACCOUNT_DELETION = 'account_deletion'

    PURPOSE_CHOICES = [
        (PURPOSE_EMAIL_VERIFICATION, 'Email Verification'),
        (PURPOSE_PASSWORD_RESET, 'Password Reset'),
        (PURPOSE_EMAIL_CHANGE, 'Email Change'),
        (PURPOSE_ACCOUNT_DELETION, 'Account Deletion'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='auth_tokens',
        help_text="Target user."
    )
    purpose = models.CharField(
        max_length=50,
        choices=PURPOSE_CHOICES,
        db_index=True,
        help_text="Purpose category of the token."
    )
    token_hash = models.CharField(
        max_length=64,
        db_index=True,
        help_text="SHA-256 hash of the generated raw token."
    )
    expires_at = models.DateTimeField(
        help_text="Timestamp when the token becomes invalid."
    )
    consumed_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Timestamp when the token was successfully used."
    )

    class Meta:
        verbose_name = 'Auth Token'
        verbose_name_plural = 'Auth Tokens'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token_hash', 'purpose', 'consumed_at']),
        ]

    @property
    def is_valid(self) -> bool:
        return self.consumed_at is None and bool(self.expires_at and self.expires_at > timezone.now())

    def consume(self):
        self.consumed_at = timezone.now()
        self.save(update_fields=['consumed_at', 'updated_at'])

    def __str__(self) -> str:
        state = "Valid" if self.is_valid else "Consumed/Expired"
        return f"Token ({self.purpose}) for {self.user.username} [{state}]"
