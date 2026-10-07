from decimal import Decimal
from django.conf import settings
from django.db import models
from common.models.base import BaseModel
from apps.billing.models.payment import Payment


class Affiliate(BaseModel):
    """
    Affiliate partner profile.
    Earns 50% commission on the first paid subscription of referred users.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='affiliate_profile',
        db_index=True
    )
    referral_code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Code d'affiliation unique (ex: ALAN2026)"
    )
    commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.50'),
        help_text="Taux de commission (50% par défaut)"
    )
    total_earnings = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = 'billing_affiliates'
        verbose_name = 'Affilié'
        verbose_name_plural = 'Affiliés'

    def __str__(self):
        return f"Affiliate {self.user.username} ({self.referral_code})"


class CommissionStatus(models.TextChoices):
    PENDING = 'PENDING', 'En attente'
    APPROVED = 'APPROVED', 'Approuvé'
    PAID = 'PAID', 'Versé'
    REJECTED = 'REJECTED', 'Rejeté'


class AffiliateCommission(BaseModel):
    """
    Commission record generated upon verified first paid subscription.
    OneToOne with Payment guarantees strict idempotency (no duplicate commissions).
    """
    affiliate = models.ForeignKey(
        Affiliate,
        on_delete=models.CASCADE,
        related_name='commissions',
        db_index=True
    )
    referred_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='generated_commissions',
        db_index=True
    )
    payment = models.OneToOneField(
        Payment,
        on_delete=models.CASCADE,
        related_name='affiliate_commission',
        db_index=True,
        help_text="Transaction de premier paiement associée"
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="50% du montant du premier paiement"
    )
    currency = models.CharField(max_length=10, default='XOF')
    status = models.CharField(
        max_length=20,
        choices=CommissionStatus.choices,
        default=CommissionStatus.APPROVED,
        db_index=True
    )

    class Meta:
        db_table = 'billing_affiliate_commissions'
        verbose_name = 'Commission d\'affiliation'
        verbose_name_plural = 'Commissions d\'affiliation'
        ordering = ['-created_at']

    def __str__(self):
        return f"Commission {int(self.amount)} {self.currency} for {self.affiliate.user.username}"
