import logging
from decimal import Decimal
from typing import Optional

from django.db import transaction
from django.db.models import F

from apps.accounts.models.user import User
from apps.billing.models.affiliate import (
    Affiliate,
    AffiliateCommission,
    CommissionStatus,
)
from apps.billing.models.payment import Payment, PaymentStatus

logger = logging.getLogger('kodinga.billing.affiliate')


class AffiliateService:
    """
    Handles affiliate referrals and 50% commission calculation on first paid subscriptions.
    """

    @classmethod
    def get_or_create_affiliate_profile(cls, user: User) -> Affiliate:
        profile, created = Affiliate.objects.get_or_create(
            user=user,
            defaults={
                'referral_code': f"{user.username.upper()[:12]}_{str(user.id)[:4]}".upper()
            }
        )
        return profile

    @classmethod
    def process_first_subscription_commission(cls, payment: Payment, referral_code: Optional[str] = None) -> Optional[AffiliateCommission]:
        """
        Calculates and credits 50% commission to the referring affiliate upon the user's first paid subscription.
        Strictly idempotent: Protected by OneToOne relation on Payment.
        """
        if payment.status != PaymentStatus.PAID:
            logger.warning(f"[Affiliate] Cannot process commission for unpaid payment {payment.id}")
            return None

        # Check if already processed
        if hasattr(payment, 'affiliate_commission') and payment.affiliate_commission:
            logger.info(f"[Affiliate] Commission already generated for payment {payment.id}")
            return payment.affiliate_commission

        # Find referring affiliate
        affiliate = None
        if referral_code:
            affiliate = Affiliate.objects.filter(referral_code__iexact=referral_code.strip(), is_active=True).first()

        if not affiliate:
            # Check if user has previously registered affiliate relationship
            first_comm = AffiliateCommission.objects.filter(referred_user=payment.user).first()
            if first_comm:
                logger.info(f"[Affiliate] User {payment.user.id} has already generated a first commission.")
                return None
            return None

        # Prevent self-referral
        if affiliate.user_id == payment.user_id:
            logger.warning(f"[Affiliate] User {payment.user.id} attempted self-referral.")
            return None

        # B1: Option A - Affiliate commissions strictly apply to platform Pro subscriptions (no community)
        if payment.plan and payment.plan.community is not None:
            logger.info(
                f"[Affiliate] Payment {payment.id} is for community {payment.plan.community_id}. "
                "Affiliate commission is strictly reserved for platform Pro plans."
            )
            return None

        # Ensure this is the first successful payment by this user
        prior_paid_count = Payment.objects.filter(
            user=payment.user,
            status=PaymentStatus.PAID
        ).exclude(id=payment.id).count()

        if prior_paid_count > 0:
            logger.info(f"[Affiliate] User {payment.user.id} has prior payments. Commission only applies to first subscription.")
            return None

        # 50% commission calculation
        rate = affiliate.commission_rate or Decimal('0.50')
        commission_amount = (payment.amount * rate).quantize(Decimal('0.01'))

        with transaction.atomic():
            commission = AffiliateCommission.objects.create(
                affiliate=affiliate,
                referred_user=payment.user,
                payment=payment,
                amount=commission_amount,
                currency=payment.currency,
                status=CommissionStatus.APPROVED
            )

            # Credit affiliate balance
            Affiliate.objects.filter(id=affiliate.id).update(
                total_earnings=F('total_earnings') + commission_amount,
                balance=F('balance') + commission_amount
            )

            logger.info(f"[Affiliate] Commission created: {commission_amount} {payment.currency} for Affiliate {affiliate.user.username} (Payment {payment.id})")
            return commission
