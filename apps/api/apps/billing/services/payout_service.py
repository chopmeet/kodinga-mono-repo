import logging

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.billing.models.wallet import CommunityPayout, CommunityWallet, PayoutStatus

logger = logging.getLogger('kodinga.billing.payout')


class PayoutService:
    """
    Manages the lifecycle and state transitions of creator payouts:
    PENDING -> APPROVED -> PROCESSED
    PENDING / APPROVED -> REJECTED (refunds wallet.available_balance)
    """

    @classmethod
    @transaction.atomic
    def approve_payout(cls, payout: CommunityPayout, admin_user=None) -> CommunityPayout:
        payout = CommunityPayout.objects.select_for_update().get(id=payout.id)
        if payout.status != PayoutStatus.PENDING:
            raise ValidationError(f"Le reversement {payout.id} ne peut pas être approuvé depuis le statut '{payout.status}'.")

        payout.status = PayoutStatus.APPROVED
        payout.save(update_fields=['status', 'updated_at'])
        logger.info(f"[PayoutService] Payout {payout.id} approved by {admin_user}")
        return payout

    @classmethod
    @transaction.atomic
    def process_payout(cls, payout: CommunityPayout, reference: str = "", admin_user=None) -> CommunityPayout:
        payout = CommunityPayout.objects.select_for_update().get(id=payout.id)
        if payout.status not in [PayoutStatus.PENDING, PayoutStatus.APPROVED]:
            raise ValidationError(f"Le reversement {payout.id} ne peut pas être traité depuis le statut '{payout.status}'.")

        payout.status = PayoutStatus.PROCESSED
        payout.processed_at = timezone.now()
        if reference:
            payout.reference = reference
        payout.save(update_fields=['status', 'processed_at', 'reference', 'updated_at'])

        # Increment withdrawn_amount on wallet
        CommunityWallet.objects.filter(community=payout.community).update(
            withdrawn_amount=F('withdrawn_amount') + payout.amount
        )
        logger.info(f"[PayoutService] Payout {payout.id} processed successfully. Reference: {payout.reference}")
        return payout

    @classmethod
    @transaction.atomic
    def reject_payout(cls, payout: CommunityPayout, rejection_reason: str = "", admin_user=None) -> CommunityPayout:
        payout = CommunityPayout.objects.select_for_update().get(id=payout.id)
        if payout.status not in [PayoutStatus.PENDING, PayoutStatus.APPROVED]:
            raise ValidationError(f"Le reversement {payout.id} ne peut pas être rejeté depuis le statut '{payout.status}'.")

        payout.status = PayoutStatus.REJECTED
        payout.rejection_reason = rejection_reason or "Demande de reversement refusée par l'administration."
        payout.save(update_fields=['status', 'rejection_reason', 'updated_at'])

        # Recredit available balance atomique
        CommunityWallet.objects.filter(community=payout.community).update(
            available_balance=F('available_balance') + payout.amount
        )
        logger.info(
            f"[PayoutService] Payout {payout.id} rejected. Recredited {payout.amount} {payout.currency} to {payout.community.name} wallet."
        )
        return payout

