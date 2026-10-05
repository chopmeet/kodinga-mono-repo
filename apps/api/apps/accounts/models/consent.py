from django.conf import settings
from django.db import models
from common.models.base import BaseModel


class UserConsent(BaseModel):
    """
    Stores GDPR and legal consent agreements recorded for users.
    """
    CONSENT_TOS = 'terms_of_service'
    CONSENT_PRIVACY = 'privacy_policy'
    CONSENT_MARKETING = 'marketing_emails'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='consents',
        help_text="Consenting user."
    )
    consent_type = models.CharField(
        max_length=100,
        help_text="Consent identifier (e.g. 'terms_of_service', 'privacy_policy')."
    )
    policy_version = models.CharField(
        max_length=50,
        help_text="Version string of the policy accepted."
    )
    granted = models.BooleanField(
        default=True,
        help_text="Indicates whether consent was granted (True) or revoked (False)."
    )
    recorded_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when consent was recorded."
    )

    class Meta:
        verbose_name = 'User Consent'
        verbose_name_plural = 'User Consents'
        ordering = ['-recorded_at']

    def __str__(self) -> str:
        status_str = "Granted" if self.granted else "Revoked"
        return f"{self.user.username}: {self.consent_type} v{self.policy_version} [{status_str}]"
