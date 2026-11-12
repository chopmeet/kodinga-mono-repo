import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.billing.gateways.paydunya import PayDunyaAPIException, PayDunyaGateway
from apps.billing.models.wallet import CommunityPayout, CommunityWallet, PayoutStatus
from apps.communities.models.community import Community

logger = logging.getLogger("kodinga.billing.payout")

# Platform payout fee: 2% deducted on disbursement
PAYOUT_FEE_RATE = Decimal("0.02")
MIN_PAYOUT_AMOUNT = Decimal("1000.00")


class PayoutService:
    """
    Manages the full lifecycle and financial accounting of community payouts:
    1. Creation & Atomic Reservation (amount deducted immediately from available_balance)
    2. Approval by Admin (PENDING -> APPROVED)
    3. Disbursement via PayDunya (APPROVED/PENDING -> PROCESSED, transfers net_amount, increments withdrawn_amount)
    4. Rejection or Failure (REJECTED/FAILED -> refunds amount back to available_balance)
    """

    @classmethod
    def calculate_payout_amounts(cls, amount: Decimal) -> tuple[Decimal, Decimal]:
        """
        Calculates platform fee (2%) and net payout amount.
        Example: 40 000 FCFA -> fee: 800 FCFA, net: 39 200 FCFA.
        """
        fee_amount = (amount * PAYOUT_FEE_RATE).quantize(Decimal("0.01"))
        net_amount = (amount - fee_amount).quantize(Decimal("0.01"))
        return fee_amount, net_amount

    @classmethod
    @transaction.atomic
    def create_payout_request(
        cls,
        community: Community,
        requested_by,
        amount: Decimal,
        payment_method: str,
        account_identifier: str,
        account_name: str = "",
    ) -> CommunityPayout:
        """
        Atomically validates balance, calculates 2% fee, reserves balance, and creates payout record.
        """
        if amount < MIN_PAYOUT_AMOUNT:
            raise ValidationError(
                f"Le montant minimum de retrait est de {int(MIN_PAYOUT_AMOUNT)} XOF."
            )

        wallet, _ = CommunityWallet.objects.select_for_update().get_or_create(
            community=community
        )

        if wallet.available_balance < amount:
            raise ValidationError(
                f"Solde disponible insuffisant ({int(wallet.available_balance)} {wallet.currency}) "
                f"pour retirer {int(amount)} {wallet.currency}."
            )

        fee_amount, net_amount = cls.calculate_payout_amounts(amount)

        # Atomic reservation: deduct from available balance
        wallet.available_balance -= amount
        wallet.save(update_fields=["available_balance", "updated_at"])

        payout = CommunityPayout.objects.create(
            community=community,
            requested_by=requested_by,
            amount=amount,
            fee_amount=fee_amount,
            net_amount=net_amount,
            currency=wallet.currency,
            status=PayoutStatus.PENDING,
            payment_method=payment_method,
            account_identifier=account_identifier,
            account_name=account_name,
        )

        logger.info(
            f"[PayoutService] Created payout {payout.id} for {community.name} - "
            f"Gross: {amount}, Fee(2%): {fee_amount}, Net: {net_amount} {wallet.currency}. "
            f"New available balance: {wallet.available_balance} {wallet.currency}"
        )
        return payout

    @classmethod
    @transaction.atomic
    def approve_payout(
        cls, payout: CommunityPayout, admin_user=None, note: str = ""
    ) -> CommunityPayout:
        """
        Marks a payout request as approved by an admin.
        """
        payout = CommunityPayout.objects.select_for_update().get(id=payout.id)
        if payout.status != PayoutStatus.PENDING:
            raise ValidationError(
                f"Le reversement {payout.id} ne peut pas être approuvé depuis le statut '{payout.status}'."
            )

        payout.status = PayoutStatus.APPROVED
        if admin_user:
            payout.processed_by = admin_user
        if note:
            payout.admin_note = note
        payout.save(update_fields=["status", "processed_by", "admin_note", "updated_at"])
        logger.info(f"[PayoutService] Payout {payout.id} approved by {admin_user}")
        return payout

    @classmethod
    @transaction.atomic
    def reject_payout(
        cls, payout: CommunityPayout, rejection_reason: str, admin_user=None, note: str = ""
    ) -> CommunityPayout:
        """
        Rejects a payout request and refunds the reserved amount back to available_balance.
        """
        payout = CommunityPayout.objects.select_for_update().get(id=payout.id)
        if payout.status not in [PayoutStatus.PENDING, PayoutStatus.APPROVED]:
            raise ValidationError(
                f"Le reversement {payout.id} ne peut pas être rejeté depuis le statut '{payout.status}'."
            )

        if not rejection_reason or not rejection_reason.strip():
            raise ValidationError("Le motif de rejet est obligatoire.")

        payout.status = PayoutStatus.REJECTED
        payout.rejection_reason = rejection_reason.strip()
        if admin_user:
            payout.processed_by = admin_user
        if note:
            payout.admin_note = note
        payout.save(
            update_fields=[
                "status",
                "rejection_reason",
                "processed_by",
                "admin_note",
                "updated_at",
            ]
        )

        # Atomic refund: re-credit reserved amount to wallet
        CommunityWallet.objects.filter(community=payout.community).update(
            available_balance=F("available_balance") + payout.amount
        )

        logger.info(
            f"[PayoutService] Payout {payout.id} rejected. Refunded {payout.amount} {payout.currency} "
            f"to {payout.community.name} wallet."
        )
        return payout

    @classmethod
    @transaction.atomic
    def process_payout(
        cls,
        payout: CommunityPayout,
        reference: str = "",
        admin_user=None,
        note: str = "",
    ) -> CommunityPayout:
        """
        Directly marks a payout as processed (useful for manual/admin override or direct settlement).
        """
        payout = CommunityPayout.objects.select_for_update().get(id=payout.id)
        if payout.status not in [PayoutStatus.PENDING, PayoutStatus.APPROVED]:
            raise ValidationError(
                f"Le reversement {payout.id} ne peut pas être validé depuis le statut '{payout.status}'."
            )

        payout.status = PayoutStatus.PROCESSED
        payout.processed_at = timezone.now()
        if reference:
            payout.reference = reference
        if admin_user:
            payout.processed_by = admin_user
        if note:
            payout.admin_note = note
        payout.save(
            update_fields=[
                "status",
                "processed_at",
                "reference",
                "processed_by",
                "admin_note",
                "updated_at",
            ]
        )

        # Increment total withdrawn amount
        CommunityWallet.objects.filter(community=payout.community).update(
            withdrawn_amount=F("withdrawn_amount") + payout.amount
        )
        logger.info(
            f"[PayoutService] Payout {payout.id} processed manually. Reference: {payout.reference}"
        )
        return payout

    @classmethod
    def disburse_via_paydunya(
        cls, payout_id, admin_user=None, note: str = ""
    ) -> CommunityPayout:
        """
        Executes real disbursement via PayDunya gateway.
        Transfers net_amount (after 2% platform fee deduction).
        Handles atomic locking, idempotency, and automatic refund in case of hard failure.
        """
        with transaction.atomic():
            payout = CommunityPayout.objects.select_for_update().get(id=payout_id)
            if payout.status not in [PayoutStatus.PENDING, PayoutStatus.APPROVED]:
                raise ValidationError(
                    f"Impossible d'exécuter le virement pour le statut '{payout.status}'."
                )

            # Ensure net_amount is properly set
            if not payout.net_amount or payout.net_amount <= 0:
                fee, net = cls.calculate_payout_amounts(payout.amount)
                payout.fee_amount = fee
                payout.net_amount = net
                payout.save(update_fields=["fee_amount", "net_amount"])

        # Call PayDunya Gateway outside database lock to avoid holding DB transaction open during HTTP
        try:
            logger.info(
                f"[PayoutService] Calling PayDunya disburse for Payout {payout.id} - "
                f"Net Amount: {payout.net_amount} {payout.currency} to {payout.account_identifier}"
            )
            disburse_res = PayDunyaGateway.disburse_payout(
                account_identifier=payout.account_identifier,
                amount=float(payout.net_amount),
                payment_method=payout.payment_method,
                payout_id=str(payout.id),
                account_name=payout.account_name,
            )
            reference = disburse_res.get("reference", "")
        except PayDunyaAPIException as exc:
            logger.error(
                f"[PayoutService] PayDunya disburse failed for Payout {payout.id}: {exc}"
            )
            # Re-credit and mark as FAILED
            with transaction.atomic():
                payout = CommunityPayout.objects.select_for_update().get(id=payout.id)
                payout.status = PayoutStatus.FAILED
                payout.rejection_reason = f"Échec du transfert PayDunya: {str(exc)}"
                if admin_user:
                    payout.processed_by = admin_user
                if note:
                    payout.admin_note = note
                payout.save(
                    update_fields=[
                        "status",
                        "rejection_reason",
                        "processed_by",
                        "admin_note",
                        "updated_at",
                    ]
                )
                CommunityWallet.objects.filter(community=payout.community).update(
                    available_balance=F("available_balance") + payout.amount
                )
            raise ValidationError(f"Échec du virement PayDunya: {exc}") from exc

        # On success, mark as PROCESSED in atomic block
        with transaction.atomic():
            payout = CommunityPayout.objects.select_for_update().get(id=payout.id)
            payout.status = PayoutStatus.PROCESSED
            payout.processed_at = timezone.now()
            payout.reference = reference
            if admin_user:
                payout.processed_by = admin_user
            if note:
                payout.admin_note = note
            payout.save(
                update_fields=[
                    "status",
                    "processed_at",
                    "reference",
                    "processed_by",
                    "admin_note",
                    "updated_at",
                ]
            )

            CommunityWallet.objects.filter(community=payout.community).update(
                withdrawn_amount=F("withdrawn_amount") + payout.amount
            )

        logger.info(
            f"[PayoutService] Payout {payout.id} disbursed and processed successfully. Reference: {reference}"
        )
        return payout
