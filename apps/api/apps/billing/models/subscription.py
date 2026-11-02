from apps.billing.models.plan import Plan
from apps.communities.models.community import Community
from common.models.base import BaseModel
from django.conf import settings
from django.db import models
from django.utils import timezone


class SubscriptionStatus(models.TextChoices):
    TRIALING = 'trialing', 'En période d\'essai'
    ACTIVE = 'active', 'Actif'
    PAST_DUE = 'past_due', 'En attente de paiement'
    CANCELED = 'canceled', 'Annulé'
    EXPIRED = 'expired', 'Expiré'


class Subscription(BaseModel):
    """
    User's active subscription to a Plan (Global Pro access or Community Pass).
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='subscriptions',
        db_index=True
    )
    plan = models.ForeignKey(
        Plan,
        on_delete=models.PROTECT,
        related_name='subscriptions',
        db_index=True
    )
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='member_subscriptions',
        db_index=True
    )
    status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.ACTIVE,
        db_index=True
    )

    current_period_start = models.DateTimeField(default=timezone.now)
    current_period_end = models.DateTimeField(db_index=True)
    cancel_at_period_end = models.BooleanField(default=False)
    canceled_at = models.DateTimeField(null=True, blank=True)

    # Provider Reference
    paydunya_token = models.CharField(max_length=255, blank=True, db_index=True)

    class Meta:
        db_table = 'billing_subscriptions'
        verbose_name = 'Abonnement'
        verbose_name_plural = 'Abonnements'
        ordering = ['-current_period_end']

    def __str__(self):
        return f"{self.user.username} - {self.plan.name} ({self.status})"

    @property
    def is_currently_valid(self) -> bool:
        return self.status in [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] and self.current_period_end > timezone.now()
