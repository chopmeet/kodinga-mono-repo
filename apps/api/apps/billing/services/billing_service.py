import logging
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

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

PRO_MONTHLY_PLAN_SLUG = 'kodinga-pro-monthly'
PRO_MONTHLY_PRICE_SETTING_KEY = 'pro_monthly_price'


class BillingService:
    """
    Core monetization business logic orchestrating PayDunya checkouts, IPN verification,
    subscriptions lifecycle and multi-tenant community access unlocks.
    """

    @classmethod
    def parse_price_value(cls, raw_val: Any) -> Optional[Decimal]:
        """
        Safely parses a price value from SystemSetting JSON (number, string, or dict).
        """
        if raw_val is None or isinstance(raw_val, bool):
            return None
        if isinstance(raw_val, dict):
            raw_val = (
                raw_val.get('amount')
                if 'amount' in raw_val
                else raw_val.get('price', raw_val.get('value'))
            )
        if raw_val is None or isinstance(raw_val, (dict, list, bool)):
            return None
        try:
            dec = Decimal(str(raw_val).strip()).quantize(Decimal('0.01'))
            return dec if dec > Decimal('0.00') else None
        except (InvalidOperation, ValueError, TypeError):
            return None

    @classmethod
    def get_pro_monthly_price(cls) -> Decimal:
        """
        Returns the authoritative monthly price for Kodinga Pro (in XOF),
        configurable by the Superadmin via SystemSetting('pro_monthly_price'),
        Django Admin Plan('kodinga-pro-monthly'), or settings.KODINGA_PRO_MONTHLY_PRICE.
        """
        from apps.administration.models.setting import SystemSetting

        setting = SystemSetting.objects.filter(key=PRO_MONTHLY_PRICE_SETTING_KEY).first()
        if setting is not None:
            parsed = cls.parse_price_value(setting.value)
            if parsed is not None:
                return parsed

        plan = Plan.objects.filter(slug=PRO_MONTHLY_PLAN_SLUG).first()
        if plan is not None and plan.price > Decimal('0.00'):
            return plan.price

        default_env = getattr(settings, 'KODINGA_PRO_MONTHLY_PRICE', '5000.00')
        parsed_env = cls.parse_price_value(default_env)
        return parsed_env if parsed_env is not None else Decimal('5000.00')

    @classmethod
    def get_pro_monthly_price_label(cls) -> str:
        """
        Returns human-readable formatted monthly price (e.g. '5 000 FCFA/mois').
        """
        price = int(cls.get_pro_monthly_price())
        formatted = f"{price:,}".replace(",", " ")
        return f"{formatted} FCFA/mois"

    @classmethod
    def set_pro_monthly_price(
        cls,
        new_price: Any,
        actor: Optional[User] = None,
    ) -> tuple[Optional[Plan], Any]:
        """
        Updates the global Kodinga Pro monthly subscription price in both
        SystemSetting('pro_monthly_price') and Plan(slug='kodinga-pro-monthly').
        """
        from apps.administration.services.admin_service import AdministrationService

        price_dec = cls.parse_price_value(new_price)
        if price_dec is None:
            raise ValidationError("Le montant de l'abonnement mensuel doit être un nombre strictement positif.")

        with transaction.atomic():
            setting = AdministrationService.set_setting(
                key=PRO_MONTHLY_PRICE_SETTING_KEY,
                value=float(price_dec),
                description="Montant mensuel de l'abonnement Kodinga Pro (en XOF / FCFA), modifiable par le superadmin.",
                is_public=True,
                actor=actor,
            )
            Plan.objects.filter(slug=PRO_MONTHLY_PLAN_SLUG).update(
                price=price_dec,
                updated_at=timezone.now(),
            )
            plan = Plan.objects.filter(slug=PRO_MONTHLY_PLAN_SLUG).first()

        return plan, setting

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
            plan = Plan.objects.select_related('community').get(id=plan_id, is_active=True)
        except Plan.DoesNotExist as err:
            raise NotFound("Plan de souscription introuvable ou inactif.") from err

        if plan.price <= Decimal("0.00"):
            raise ValidationError("Ce forfait est gratuit et ne nécessite aucun paiement.")

        if plan.community:
            if plan.community.owner_id == user.id:
                raise ValidationError("Vous êtes le propriétaire de cette communauté et y avez déjà un accès complet.")
            is_banned = CommunityMember.objects.filter(
                community=plan.community,
                user=user,
                status=MembershipStatus.BANNED,
            ).exists()
            if is_banned:
                raise ValidationError("Vous êtes banni de cette communauté et ne pouvez pas souscrire à son abonnement.")

            # B2: Check for active disciplinary suspension sanction
            from apps.memberships.models.sanction import MemberSanction, SanctionType
            has_active_suspension = MemberSanction.objects.filter(
                member__community=plan.community,
                member__user=user,
                sanction_type=SanctionType.SUSPENSION,
                is_active=True
            ).exists()
            if has_active_suspension:
                raise ValidationError("Votre compte fait l'objet d'une suspension disciplinaire active dans cette communauté.")

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
                    from django.db.models import F

                    from apps.communities.models.community import Community

                    member, created = CommunityMember.objects.select_for_update().get_or_create(
                        community=plan.community,
                        user=payment.user,
                        defaults={
                            'role': CommunityRole.MEMBER,
                            'status': MembershipStatus.ACTIVE
                        }
                    )
                    if created:
                        Community.objects.filter(id=plan.community_id).update(
                            members_count=F('members_count') + 1
                        )
                    elif member.status not in [MembershipStatus.ACTIVE, MembershipStatus.BANNED]:
                        # B2: Check if member has an active disciplinary suspension sanction before reactivating to ACTIVE
                        from apps.memberships.models.sanction import (
                            MemberSanction,
                            SanctionType,
                        )
                        has_active_suspension = MemberSanction.objects.filter(
                            member=member,
                            sanction_type=SanctionType.SUSPENSION,
                            is_active=True
                        ).exists()
                        if not has_active_suspension:
                            member.status = MembershipStatus.ACTIVE
                            member.save(update_fields=['status', 'updated_at'])
                            Community.objects.filter(id=plan.community_id).update(
                                members_count=F('members_count') + 1
                            )
                        else:
                            logger.info(
                                f"[Billing] Member {member.id} renewed subscription but remains SUSPENDED due to active disciplinary sanction."
                            )

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
