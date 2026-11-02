from decimal import Decimal

from apps.billing.models.plan import Plan
from apps.billing.models.subscription import Subscription
from common.models.base import BaseModel
from django.conf import settings
from django.db import models


class PaymentStatus(models.TextChoices):
    PENDING = 'PENDING', 'En attente de paiement'
    PROCESSING = 'PROCESSING', 'Traitement en cours'
    PAID = 'PAID', 'Payé avec succès'
    FAILED = 'FAILED', 'Échec du paiement'
    CANCELLED = 'CANCELLED', 'Annulé par l\'utilisateur'


class Payment(BaseModel):
    """
    Immutable payment transaction record.
    Acts as the single source of truth for billing auditing and idempotent reconciliation.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payments',
        db_index=True
    )
    plan = models.ForeignKey(
        Plan,
        on_delete=models.PROTECT,
        related_name='payments',
        db_index=True
    )
    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments',
        db_index=True
    )

    provider = models.CharField(max_length=50, default='paydunya', db_index=True)
    provider_token = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="Jeton de facture PayDunya unique"
    )
    provider_reference = models.CharField(
        max_length=255,
        blank=True,
        help_text="Référence de transaction ou reçu PayDunya"
    )
    checkout_url = models.URLField(
        max_length=600,
        blank=True,
        help_text="URL de redirection vers la passerelle de paiement PayDunya"
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Montant exact calculé côté serveur"
    )
    platform_fee = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Commission de plateforme Kodinga"
    )
    net_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Montant net revenant au créateur de la communauté"
    )
    referral_code = models.CharField(
        max_length=50,
        blank=True,
        default='',
        db_index=True,
        help_text="Code d'affiliation partenaire"
    )
    currency = models.CharField(max_length=10, default='XOF')
    status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
        db_index=True
    )
    paid_at = models.DateTimeField(null=True, blank=True)

    # Raw audit payload from verified server IPN callback
    raw_callback_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Payload officiel retourné par PayDunya lors de la confirmation serveur"
    )

    class Meta:
        db_table = 'billing_payments'
        verbose_name = 'Paiement / Transaction'
        verbose_name_plural = 'Paiements / Transactions'
        ordering = ['-created_at']

    def __str__(self):
        return f"Payment {self.id} - {self.user.username} - {int(self.amount)} {self.currency} ({self.status})"
