import logging
from datetime import timedelta
from decimal import Decimal
from typing import Optional

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.accounts.models.user import User
from apps.billing.gateways.paydunya import PayDunyaGateway
from apps.billing.models.payment import Payment, PaymentStatus
from apps.billing.models.plan import BillingInterval, Plan
from apps.billing.models.subscription import Subscription, SubscriptionStatus
from apps.billing.models.wallet import CommunityWallet
from apps.billing.services.affiliate_service import AffiliateService
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)

logger = logging.getLogger('kodinga.billing')


class BillingService:
    """
    Core monetization business logic orchestrating PayDunya checkouts, IPN verification,
    subscriptions lifecycle and multi-tenant community access unlocks.
    """

    @classmethod
    def calculate_period_end(cls, start_time, billing_interval: str, interval_count: int = 1):
        if billing_interval == BillingInterval.MONTH:
            return start_time + timedelta(days=30 * interval_count)
        elif billing_interval == BillingInterval.YEAR:
            return start_time + timedelta(days=365 * interval_count)
        elif billing_interval == BillingInterval.ONE_TIME:
            return start_time + timedelta(days=3650)  # 10 years / lifetime access
        return start_time + timedelta(days=30)

    @classmethod
    def create_checkout_session(
        cls,
        user: User,
        plan_id: str,
        referral_code: Optional[str] = None,
        return_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
        callback_url: Optional[str] = None,
    ) -> tuple[Payment, str]:
        """
        Creates a local pending Payment with server-verified plan pricing,
        initializes the PayDunya checkout invoice session, and returns (payment, checkout_url).
        """
        try:
            plan = Plan.objects.get(id=plan_id, is_active=True)
        except Plan.DoesNotExist as err:
            raise NotFound("Plan de souscription introuvable ou inactif.") from err

        if plan.price <= Decimal("0.00"):
            raise ValidationError("Ce forfait est gratuit et ne nécessite aucun paiement.")

        with transaction.atomic():
            # Create local pending payment
            payment = Payment.objects.create(
                user=user,
                plan=plan,
                amount=plan.price,
                currency=plan.currency,
                status=PaymentStatus.PENDING,
                provider='paydunya',
                referral_code=referral_code or ''
            )

            # Initialize PayDunya Checkout
            invoice_data = PayDunyaGateway.create_checkout_invoice(
                payment_id=str(payment.id),
                amount=float(plan.price),
                plan_name=plan.name,
                plan_id=str(plan.id),
                user_id=str(user.id),
                user_email=user.email,
                description=plan.description,
                referral_code=referral_code,
                return_url=return_url,
                cancel_url=cancel_url,
                callback_url=callback_url
            )

            payment.provider_token = invoice_data['token']
            payment.checkout_url = invoice_data['checkout_url']
            payment.save(update_fields=['provider_token', 'checkout_url', 'updated_at'])

            logger.info(f"[Billing] Checkout session created for User={user.username}, Payment={payment.id}, Token={payment.provider_token}")
            return payment, payment.checkout_url

    @classmethod
    def process_paydunya_ipn(cls, token: str, raw_payload: Optional[dict] = None) -> Payment:
        """
        Idempotent verification of PayDunya IPN callback.
        Calls PayDunya servers directly to verify transaction status before modifying any DB state.
        Guarantees thread safety and race condition prevention with select_for_update().
        """
        logger.info(f"[Billing] Processing IPN for Token={token}")

        # 1. Fetch official transaction status from PayDunya official API
        verified_data = PayDunyaGateway.confirm_invoice(token)
        paydunya_status = str(verified_data.get('status', '')).lower()

        # 2. Extract payment id or token to identify record
        custom_data = verified_data.get('custom_data', {})
        payment_id = custom_data.get('payment_id')

        # 3. Process DB state transition with pessimistic locking inside transaction
        with transaction.atomic():
            payment_qs = Payment.objects.select_for_update().select_related('plan', 'plan__community', 'user')
            payment = None
            if payment_id:
                payment = payment_qs.filter(id=payment_id).first()

            if not payment:
                payment = payment_qs.filter(provider_token=token).first()

            if not payment:
                logger.error(f"[Billing] Payment not found for verified token {token} / id {payment_id}")
                raise NotFound("Paiement local introuvable pour ce jeton PayDunya.")

            # Idempotency guard: If already paid, return early without re-executing
            if payment.status == PaymentStatus.PAID:
                logger.info(f"[Billing] Payment {payment.id} is already marked PAID. Idempotent skip.")
                return payment

            # Handle transaction statuses
            if paydunya_status == 'completed':
                receipt_url = verified_data.get('receipt_url') or verified_data.get('invoice', {}).get('receipt_url', '')
                now = timezone.now()
                plan = payment.plan

                # Calculate Kodinga Platform Commission & Creator Net
                commission_rate = getattr(settings, 'KODINGA_COMMISSION_RATE', Decimal('0.10'))
                if plan.community:
                    platform_fee = (payment.amount * Decimal(str(commission_rate))).quantize(Decimal('0.01'))
                    net_amount = payment.amount - platform_fee
                    payment.platform_fee = platform_fee
                    payment.net_amount = net_amount

                    # Credit Community Wallet
                    wallet, _ = CommunityWallet.objects.select_for_update().get_or_create(
                        community=plan.community,
                        defaults={'currency': payment.currency}
                    )
                    wallet.total_gross += payment.amount
                    wallet.total_platform_fees += platform_fee
                    wallet.total_net += net_amount
                    wallet.available_balance += net_amount
                    wallet.save()
                else:
                    payment.platform_fee = payment.amount
                    payment.net_amount = Decimal('0.00')

                payment.status = PaymentStatus.PAID
                payment.paid_at = now
                payment.provider_reference = receipt_url
                payment.raw_callback_data = verified_data

                # Create or extend active Subscription
                period_end = cls.calculate_period_end(now, plan.billing_interval, plan.interval_count)

                existing_sub = Subscription.objects.select_for_update().filter(
                    user=payment.user,
                    plan=plan,
                    status=SubscriptionStatus.ACTIVE
                ).first()

                if existing_sub and existing_sub.current_period_end > now:
                    # Extend period from current end
                    new_period_end = cls.calculate_period_end(existing_sub.current_period_end, plan.billing_interval, plan.interval_count)
                    existing_sub.current_period_end = new_period_end
                    existing_sub.paydunya_token = token
                    existing_sub.cancel_at_period_end = False
                    existing_sub.save(update_fields=['current_period_end', 'paydunya_token', 'cancel_at_period_end', 'updated_at'])
                    subscription = existing_sub
                else:
                    subscription = Subscription.objects.create(
                        user=payment.user,
                        plan=plan,
                        community=plan.community,
                        status=SubscriptionStatus.ACTIVE,
                        current_period_start=now,
                        current_period_end=period_end,
                        paydunya_token=token
                    )

                payment.subscription = subscription
                payment.save()

                # Unlock Community Membership if plan is community-specific
                if plan.community:
                    member, _ = CommunityMember.objects.select_for_update().get_or_create(
                        community=plan.community,
                        user=payment.user,
                        defaults={
                            'role': CommunityRole.MEMBER,
                            'status': MembershipStatus.ACTIVE
                        }
                    )
                    if member.status != MembershipStatus.ACTIVE:
                        member.status = MembershipStatus.ACTIVE
                        member.save(update_fields=['status', 'updated_at'])

                # Process 50% affiliate commission on first paid subscription
                ref_code = payment.referral_code or custom_data.get('referral_code')
                AffiliateService.process_first_subscription_commission(payment, referral_code=ref_code)

                logger.info(f"[Billing] Payment {payment.id} confirmed and Subscription {subscription.id} activated successfully.")
                return payment

            elif paydunya_status in ['pending', 'in_progress', 'created', 'processing']:
                # Feedback 2: Maintain PENDING if PayDunya returns pending
                logger.info(f"[Billing] Payment {payment.id} is still {paydunya_status}. Maintaining PENDING status.")
                payment.status = PaymentStatus.PENDING
                payment.raw_callback_data = verified_data
                payment.save(update_fields=['status', 'raw_callback_data', 'updated_at'])
                return payment

            elif paydunya_status in ['cancelled', 'canceled']:
                payment.status = PaymentStatus.CANCELLED
                payment.raw_callback_data = verified_data
                payment.save(update_fields=['status', 'raw_callback_data', 'updated_at'])
                return payment

            else:
                payment.status = PaymentStatus.FAILED
                payment.raw_callback_data = verified_data
                payment.save(update_fields=['status', 'raw_callback_data', 'updated_at'])
                return payment
