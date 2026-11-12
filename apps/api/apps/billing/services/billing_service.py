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

logger = logging.getLogger("kodinga.billing")

PRO_MONTHLY_PLAN_SLUG = "kodinga-pro-monthly"
PRO_MONTHLY_PRICE_SETTING_KEY = "pro_monthly_price"


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
                raw_val.get("amount")
                if "amount" in raw_val
                else raw_val.get("price", raw_val.get("value"))
            )
        if raw_val is None or isinstance(raw_val, (dict, list, bool)):
            return None
        try:
            dec = Decimal(str(raw_val).strip()).quantize(Decimal("0.01"))
            return dec if dec > Decimal("0.00") else None
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

        setting = SystemSetting.objects.filter(
            key=PRO_MONTHLY_PRICE_SETTING_KEY
        ).first()
        if setting is not None:
            parsed = cls.parse_price_value(setting.value)
            if parsed is not None:
                return parsed

        plan = Plan.objects.filter(slug=PRO_MONTHLY_PLAN_SLUG).first()
        if plan is not None and plan.price > Decimal("0.00"):
            return plan.price

        default_env = getattr(settings, "KODINGA_PRO_MONTHLY_PRICE", "5000.00")
        parsed_env = cls.parse_price_value(default_env)
        return parsed_env if parsed_env is not None else Decimal("5000.00")

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
            raise ValidationError(
                "Le montant de l'abonnement mensuel doit être un nombre strictement positif."
            )

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
    def calculate_period_end(
        cls, start_time, billing_interval: str, interval_count: int = 1
    ):
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
            plan = Plan.objects.select_related("community").get(
                id=plan_id, is_active=True
            )
        except Plan.DoesNotExist as err:
            raise NotFound("Plan de souscription introuvable ou inactif.") from err

        if plan.price <= Decimal("0.00"):
            raise ValidationError(
                "Ce forfait est gratuit et ne nécessite aucun paiement."
            )

        if plan.community:
            if plan.community.owner_id == user.id:
                raise ValidationError(
                    "Vous êtes le propriétaire de cette communauté et y avez déjà un accès complet."
                )
            is_banned = CommunityMember.objects.filter(
                community=plan.community,
                user=user,
                status=MembershipStatus.BANNED,
            ).exists()
            if is_banned:
                raise ValidationError(
                    "Vous êtes banni de cette communauté et ne pouvez pas souscrire à son abonnement."
                )

            # B2: Check for active disciplinary suspension sanction
            from apps.memberships.models.sanction import MemberSanction, SanctionType

            has_active_suspension = MemberSanction.objects.filter(
                member__community=plan.community,
                member__user=user,
                sanction_type=SanctionType.SUSPENSION,
                is_active=True,
            ).exists()
            if has_active_suspension:
                raise ValidationError(
                    "Votre compte fait l'objet d'une suspension disciplinaire active dans cette communauté."
                )

        with transaction.atomic():
            # Create local pending payment
            payment = Payment.objects.create(
                user=user,
                plan=plan,
                amount=plan.price,
                currency=plan.currency,
                status=PaymentStatus.PENDING,
                provider="paydunya",
                referral_code=referral_code or "",
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
                callback_url=callback_url,
            )

            payment.provider_token = invoice_data["token"]
            payment.checkout_url = invoice_data["checkout_url"]
            payment.save(update_fields=["provider_token", "checkout_url", "updated_at"])

            logger.info(
                f"[Billing] Checkout session created for User={user.username}, Payment={payment.id}, Token={payment.provider_token}"
            )
            return payment, payment.checkout_url

    @staticmethod
    def normalize_payment_channel(raw_channel: str) -> str:
        """
        Normalizes PayDunya or raw gateway payment method names into human-readable channels.
        e.g. orange-money-senegal -> Orange Money, wave -> Wave, mtn -> MTN MoMo, etc.
        """
        if not raw_channel or not isinstance(raw_channel, str):
            return ""
        c = raw_channel.lower().strip()
        if "orange" in c:
            return "Orange Money"
        if "wave" in c:
            return "Wave"
        if "mtn" in c:
            return "MTN MoMo"
        if "moov" in c:
            return "Moov Money"
        if any(k in c for k in ["card", "carte", "visa", "mastercard", "cb"]):
            return "Carte bancaire"
        if "free" in c:
            return "Free Money"
        return raw_channel.strip().title()

    @classmethod
    def finalize_payment_as_paid(
        cls,
        payment: Payment,
        receipt_url: str = "",
        verified_data: Optional[dict] = None,
    ) -> Payment:
        """
        Marks a payment as PAID, creates/extends subscription, credits community wallet,
        and unlocks community membership. Single source of truth for payment completion.
        """
        with transaction.atomic():
            payment = (
                Payment.objects.select_for_update(of=("self",))
                .select_related("plan", "plan__community", "user")
                .get(id=payment.id)
            )

            if payment.status == PaymentStatus.PAID:
                return payment

            now = timezone.now()
            plan = payment.plan

            if plan.community:
                # Community membership subscriptions:
                # The creator receives 100% of the subscription price as net revenue.
                # No commission is deducted at incoming payment.
                # Platform fees (2%) are applied only upon withdrawal/payout disbursement.
                platform_fee = Decimal("0.00")
                net_amount = payment.amount
                payment.platform_fee = platform_fee
                payment.net_amount = net_amount

                wallet, _ = CommunityWallet.objects.select_for_update().get_or_create(
                    community=plan.community,
                    defaults={"currency": payment.currency},
                )
                wallet.total_gross += payment.amount
                wallet.total_platform_fees += platform_fee
                wallet.total_net += net_amount
                wallet.available_balance += net_amount
                wallet.save()
            else:
                payment.platform_fee = payment.amount
                payment.net_amount = Decimal("0.00")

            payment.status = PaymentStatus.PAID
            payment.paid_at = now
            if receipt_url:
                payment.provider_reference = receipt_url
            if verified_data:
                payment.raw_callback_data = verified_data
                invoice_data = (
                    verified_data.get("invoice")
                    if isinstance(verified_data.get("invoice"), dict)
                    else {}
                )
                custom_data = (
                    verified_data.get("custom_data")
                    if isinstance(verified_data.get("custom_data"), dict)
                    else {}
                )
                raw_chan = (
                    verified_data.get("payment_method")
                    or invoice_data.get("payment_method")
                    or verified_data.get("channel")
                    or invoice_data.get("channel")
                    or verified_data.get("mode")
                    or custom_data.get("payment_channel")
                )
                if raw_chan:
                    payment.payment_channel = cls.normalize_payment_channel(raw_chan)

            # Create or extend active Subscription
            period_end = cls.calculate_period_end(
                now, plan.billing_interval, plan.interval_count
            )

            existing_sub = (
                Subscription.objects.select_for_update()
                .filter(user=payment.user, plan=plan, status=SubscriptionStatus.ACTIVE)
                .first()
            )

            if existing_sub and existing_sub.current_period_end > now:
                new_period_end = cls.calculate_period_end(
                    existing_sub.current_period_end,
                    plan.billing_interval,
                    plan.interval_count,
                )
                existing_sub.current_period_end = new_period_end
                existing_sub.paydunya_token = payment.provider_token
                existing_sub.cancel_at_period_end = False
                existing_sub.save(
                    update_fields=[
                        "current_period_end",
                        "paydunya_token",
                        "cancel_at_period_end",
                        "updated_at",
                    ]
                )
                subscription = existing_sub
            else:
                subscription = Subscription.objects.create(
                    user=payment.user,
                    plan=plan,
                    community=plan.community,
                    status=SubscriptionStatus.ACTIVE,
                    current_period_start=now,
                    current_period_end=period_end,
                    paydunya_token=payment.provider_token,
                )

            payment.subscription = subscription
            payment.save()

            # Unlock Community Membership if plan is community-specific
            if plan.community:
                from django.db.models import F

                from apps.communities.models.community import Community

                member, created = (
                    CommunityMember.objects.select_for_update().get_or_create(
                        community=plan.community,
                        user=payment.user,
                        defaults={
                            "role": CommunityRole.MEMBER,
                            "status": MembershipStatus.ACTIVE,
                        },
                    )
                )
                if created:
                    Community.objects.filter(id=plan.community_id).update(
                        members_count=F("members_count") + 1
                    )
                elif member.status not in [
                    MembershipStatus.ACTIVE,
                    MembershipStatus.BANNED,
                ]:
                    from apps.memberships.models.sanction import (
                        MemberSanction,
                        SanctionType,
                    )

                    has_active_suspension = MemberSanction.objects.filter(
                        member=member,
                        sanction_type=SanctionType.SUSPENSION,
                        is_active=True,
                    ).exists()
                    if not has_active_suspension:
                        member.status = MembershipStatus.ACTIVE
                        member.save(update_fields=["status", "updated_at"])
                        Community.objects.filter(id=plan.community_id).update(
                            members_count=F("members_count") + 1
                        )

            try:
                ref_code = payment.referral_code
                AffiliateService.process_first_subscription_commission(
                    payment, referral_code=ref_code
                )
            except Exception as aff_err:
                logger.warning(
                    f"[Billing] Affiliate commission processing failed for Payment {payment.id}: {aff_err}"
                )

            logger.info(
                f"[Billing] Payment {payment.id} confirmed and Subscription {subscription.id} activated successfully."
            )
            return payment

    @classmethod
    def process_paydunya_ipn(
        cls, token: str, raw_payload: Optional[dict] = None
    ) -> Payment:
        """
        Idempotent verification of PayDunya IPN callback.
        Calls PayDunya servers directly to verify transaction status before modifying any DB state.
        Guarantees thread safety and race condition prevention with select_for_update().
        """
        logger.info(f"[Billing] Processing IPN for Token={token}")

        # 1. Fetch official transaction status from PayDunya official API
        verified_data = PayDunyaGateway.confirm_invoice(token)
        if not isinstance(verified_data, dict):
            verified_data = {}

        invoice_obj = verified_data.get("invoice")
        if not isinstance(invoice_obj, dict):
            invoice_obj = {}

        data_obj = verified_data.get("data")
        if not isinstance(data_obj, dict):
            data_obj = {}

        # Look in all potential status locations from PayDunya API responses
        raw_status = (
            verified_data.get("status")
            or invoice_obj.get("status")
            or data_obj.get("status")
            or verified_data.get("transaction_status")
            or ""
        )
        paydunya_status = str(raw_status).strip().lower()

        # 2. Extract payment id or token to identify record (guard against PHP [] list serialization)
        custom_data = (
            verified_data.get("custom_data")
            or invoice_obj.get("custom_data")
            or data_obj.get("custom_data")
        )
        if not isinstance(custom_data, dict):
            custom_data = {}
        payment_id = custom_data.get("payment_id")

        SUCCESS_STATUSES = {
            "completed",
            "paid",
            "success",
            "succeeded",
            "confirmée",
            "confirmee",
            "succès",
            "succes",
            "payé",
            "paye",
        }
        CANCEL_STATUSES = {"cancelled", "canceled", "annulée", "annulee"}
        FAIL_STATUSES = {"failed", "fail", "échoué", "echoue", "error"}

        # 3. Process DB state transition with pessimistic locking inside transaction
        with transaction.atomic():
            payment_qs = Payment.objects.select_for_update(of=("self",)).select_related(
                "plan", "plan__community", "user"
            )
            payment = None
            if payment_id:
                try:
                    payment = payment_qs.filter(id=payment_id).first()
                except Exception:
                    payment = None

            if not payment:
                payment = payment_qs.filter(provider_token=token).first()

            if not payment:
                logger.error(
                    f"[Billing] Payment not found for verified token {token} / id {payment_id}"
                )
                raise NotFound("Paiement local introuvable pour ce jeton PayDunya.")

            # Idempotency guard: If already paid, return early without re-executing
            if payment.status == PaymentStatus.PAID:
                logger.info(
                    f"[Billing] Payment {payment.id} is already marked PAID. Idempotent skip."
                )
                return payment

            # Handle transaction statuses
            if paydunya_status in SUCCESS_STATUSES:
                receipt_url = (
                    verified_data.get("receipt_url")
                    or verified_data.get("receiptURL")
                    or invoice_obj.get("receipt_url")
                    or invoice_obj.get("receiptURL")
                    or data_obj.get("receipt_url")
                    or ""
                )
                return cls.finalize_payment_as_paid(
                    payment=payment,
                    receipt_url=receipt_url,
                    verified_data=verified_data,
                )

            elif paydunya_status in [
                "pending",
                "in_progress",
                "created",
                "processing",
                "en attente",
                "en_attente",
            ]:
                logger.info(
                    f"[Billing] Payment {payment.id} is still {paydunya_status}. Maintaining PENDING status."
                )
                payment.status = PaymentStatus.PENDING
                payment.raw_callback_data = verified_data
                payment.save(
                    update_fields=["status", "raw_callback_data", "updated_at"]
                )
                return payment

            elif paydunya_status in CANCEL_STATUSES:
                payment.status = PaymentStatus.CANCELLED
                payment.raw_callback_data = verified_data
                payment.save(
                    update_fields=["status", "raw_callback_data", "updated_at"]
                )
                return payment

            elif paydunya_status in FAIL_STATUSES:
                payment.status = PaymentStatus.FAILED
                payment.raw_callback_data = verified_data
                payment.save(
                    update_fields=["status", "raw_callback_data", "updated_at"]
                )
                return payment

            else:
                logger.warning(
                    f"[Billing] Unhandled PayDunya status '{paydunya_status}' for Payment {payment.id}"
                )
                payment.raw_callback_data = verified_data
                payment.save(update_fields=["raw_callback_data", "updated_at"])
                return payment

    @classmethod
    def reconcile_pending_payments(cls, payments_qs) -> None:
        """
        Proactively checks up to 3 recent PENDING payments with PayDunya in case
        the webhook IPN was delayed/blocked or the user returned without hitting ?payment=done.
        """
        if getattr(settings, "IS_TESTING", False):
            return
        try:
            pending_list = list(
                payments_qs.filter(status=PaymentStatus.PENDING)
                .exclude(provider_token="")
                .exclude(provider_token__isnull=True)
                .order_by("-created_at")[:3]
            )
            for p in pending_list:
                try:
                    cls.process_paydunya_ipn(token=p.provider_token)
                except Exception as e:
                    logger.debug(
                        f"[Billing] Auto-reconcile skipped for Payment {p.id}: {e}"
                    )
        except Exception as e:
            logger.debug(f"[Billing] reconcile_pending_payments error: {e}")
