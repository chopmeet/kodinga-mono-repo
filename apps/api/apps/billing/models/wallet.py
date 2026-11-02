from decimal import Decimal

from apps.communities.models.community import Community
from common.models.base import BaseModel
from django.conf import settings
from django.db import models


class PayoutStatus(models.TextChoices):
    PENDING = 'pending', 'En attente'
    APPROVED = 'approved', 'Approuvé'
    PROCESSED = 'processed', 'Effectué'
    REJECTED = 'rejected', 'Refusé'


class CommunityWallet(BaseModel):
    """
    Dedicated financial account and balances for a Community.
    Tracks gross receipts, platform commissions, net earnings, and available payout balances.
    """
    community = models.OneToOneField(
        Community,
        on_delete=models.CASCADE,
        related_name='wallet',
        db_index=True
    )

    total_gross = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total des encaissements bruts reçus des membres"
    )
    total_platform_fees = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total des commissions prélevées par Kodinga"
    )
    total_net = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total des revenus nets générés pour le créateur"
    )
    withdrawn_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Montant total déjà reversé au créateur"
    )
    available_balance = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Solde actuellement disponible au retrait"
    )

    currency = models.CharField(max_length=10, default='XOF')
    payout_phone = models.CharField(max_length=50, blank=True, help_text="Numéro Wave / Orange Money par défaut")
    payout_provider = models.CharField(max_length=50, default='wave', blank=True, help_text="Moyen de retrait (ex: wave, orange_money)")

    class Meta:
        db_table = 'billing_community_wallets'
        verbose_name = 'Portefeuille Communauté'
        verbose_name_plural = 'Portefeuilles Communautés'

    def __str__(self):
        return f"Wallet {self.community.name} - Solde dispo: {int(self.available_balance)} {self.currency}"


class CommunityPayout(BaseModel):
    """
    Withdrawal request from a community creator to receive their net earnings.
    """
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name='payout_requests',
        db_index=True
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='community_payouts',
        db_index=True
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Montant demandé au reversement"
    )
    currency = models.CharField(max_length=10, default='XOF')
    status = models.CharField(
        max_length=20,
        choices=PayoutStatus.choices,
        default=PayoutStatus.PENDING,
        db_index=True
    )

    payment_method = models.CharField(max_length=50, default='wave', help_text="wave, orange_money, bank_transfer")
    account_identifier = models.CharField(max_length=100, help_text="Numéro de mobile money ou IBAN/RIB")
    account_name = models.CharField(max_length=150, blank=True, help_text="Nom du titulaire du compte")

    reference = models.CharField(max_length=255, blank=True, help_text="Référence externe de la transaction")
    processed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        db_table = 'billing_community_payouts'
        verbose_name = 'Demande de reversement'
        verbose_name_plural = 'Demandes de reversements'
        ordering = ['-created_at']

    def __str__(self):
        return f"Payout #{self.id} - {self.community.name} - {int(self.amount)} {self.currency} ({self.status})"
