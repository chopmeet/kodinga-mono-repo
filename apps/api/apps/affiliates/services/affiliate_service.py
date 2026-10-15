from decimal import Decimal
from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from common.permissions.base import is_superadmin_user

from apps.affiliates.models.click import AffiliateClick
from apps.affiliates.models.link import AffiliateLink
from apps.affiliates.models.payout import PayoutRequest, PayoutStatus


class AffiliateService:
    """
    Business logic for affiliate referral links, clicks tracking, and payouts.
    """

    @classmethod
    @transaction.atomic
    def create_link(cls, user, program=None, custom_slug=None, target_url=""):
        if custom_slug:
            custom_slug = custom_slug.lower().strip()
            if AffiliateLink.objects.filter(custom_slug=custom_slug).exists():
                raise ValidationError("Ce slug personnalisé est déjà utilisé.")

        link = AffiliateLink.objects.create(
            user=user,
            program=program,
            custom_slug=custom_slug or None,
            target_url=target_url or "",
        )
        return link

    @classmethod
    @transaction.atomic
    def record_click(cls, code_or_slug, ip_address="", referrer="", user_agent=""):
        link = (
            AffiliateLink.objects.filter(is_active=True)
            .filter(code=code_or_slug)
            .first()
            or AffiliateLink.objects.filter(is_active=True)
            .filter(custom_slug=code_or_slug)
            .first()
        )
        if not link:
            return None

        AffiliateLink.objects.filter(id=link.id).update(clicks_count=F("clicks_count") + 1)
        link.refresh_from_db(fields=["clicks_count"])

        AffiliateClick.objects.create(
            link=link,
            ip_address=ip_address or None,
            referrer=referrer or "",
            user_agent=user_agent or "",
        )
        return link

    @classmethod
    @transaction.atomic
    def record_conversion(cls, link, commission_amount):
        commission = Decimal(str(commission_amount))
        AffiliateLink.objects.filter(id=link.id).update(
            conversions_count=F("conversions_count") + 1,
            total_earnings=F("total_earnings") + commission,
        )
        link.refresh_from_db(fields=["conversions_count", "total_earnings"])
        return link

    @classmethod
    @transaction.atomic
    def request_payout(cls, user, amount, payout_method, payout_details):
        amount_dec = Decimal(str(amount))
        if amount_dec <= Decimal("0.00"):
            raise ValidationError("Le montant du retrait doit être strictement positif.")

        # Calculate user's total earnings
        total_earned = (
            AffiliateLink.objects.filter(user=user).aggregate(total=Sum("total_earnings"))["total"]
            or Decimal("0.00")
        )

        # Sum pending or approved or paid payouts
        committed_payouts = (
            PayoutRequest.objects.filter(
                user=user, status__in=[PayoutStatus.PENDING, PayoutStatus.APPROVED, PayoutStatus.PAID]
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

        available_balance = total_earned - committed_payouts
        if amount_dec > available_balance:
            raise ValidationError(
                f"Solde insuffisant ({available_balance} XOF disponibles, {amount_dec} XOF demandés)."
            )

        payout = PayoutRequest.objects.create(
            user=user,
            amount=amount_dec,
            payout_method=payout_method,
            payout_details=payout_details or {},
            status=PayoutStatus.PENDING,
        )
        return payout

    @classmethod
    def process_payout(cls, payout_id, admin_user, new_status, notes=""):
        if not (admin_user.is_staff or is_superadmin_user(admin_user)):
            raise PermissionDenied("Action réservée aux administrateurs.")

        payout = PayoutRequest.objects.filter(id=payout_id).first()
        if not payout:
            raise ValidationError("Demande de retrait introuvable.")

        payout.status = new_status
        payout.notes = notes
        payout.processed_at = timezone.now()
        payout.save(update_fields=["status", "notes", "processed_at", "updated_at"])
        return payout
