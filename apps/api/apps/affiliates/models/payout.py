from django.conf import settings
from django.db import models

from common.models.base import BaseModel


class PayoutMethod(models.TextChoices):
    WAVE = "wave", "Wave Mobile Money"
    ORANGE_MONEY = "orange_money", "Orange Money"
    MTN_MOMO = "mtn_momo", "MTN MoMo"
    BANK_TRANSFER = "bank_transfer", "Virement Bancaire"


class PayoutStatus(models.TextChoices):
    PENDING = "pending", "En attente de traitement"
    APPROVED = "approved", "Approuvé"
    PAID = "paid", "Payé"
    REJECTED = "rejected", "Rejeté"


class PayoutRequest(BaseModel):
    """
    Withdrawal / payout request submitted by an affiliate.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="payout_requests",
        db_index=True,
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default="XOF")
    payout_method = models.CharField(
        max_length=30,
        choices=PayoutMethod.choices,
        default=PayoutMethod.WAVE,
    )
    payout_details = models.JSONField(
        default=dict,
        help_text="Numéro de téléphone, IBAN ou détails de bénéficiaire.",
    )
    status = models.CharField(
        max_length=20,
        choices=PayoutStatus.choices,
        default=PayoutStatus.PENDING,
        db_index=True,
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "affiliate_payout_requests"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Payout {self.amount} {self.currency} for {self.user.username} ({self.status})"
