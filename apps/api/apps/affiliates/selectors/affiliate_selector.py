from decimal import Decimal

from apps.affiliates.models.link import AffiliateLink
from apps.affiliates.models.payout import PayoutRequest, PayoutStatus
from django.db.models import Sum


class AffiliateSelector:
    """
    Optimized queries and statistics for the creator/affiliate dashboard.
    """

    @classmethod
    def get_user_links(cls, user):
        return (
            AffiliateLink.objects.filter(user=user)
            .select_related("program")
            .order_by("-created_at")
        )

    @classmethod
    def get_user_payouts(cls, user):
        return PayoutRequest.objects.filter(user=user).order_by("-created_at")

    @classmethod
    def get_user_stats(cls, user):
        links = AffiliateLink.objects.filter(user=user)
        total_links = links.count()
        total_clicks = links.aggregate(total=Sum("clicks_count"))["total"] or 0
        total_conversions = links.aggregate(total=Sum("conversions_count"))["total"] or 0
        total_earnings = links.aggregate(total=Sum("total_earnings"))["total"] or Decimal("0.00")

        payouts = PayoutRequest.objects.filter(user=user)
        paid_amount = (
            payouts.filter(status=PayoutStatus.PAID).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        pending_amount = (
            payouts.filter(status=PayoutStatus.PENDING).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )

        committed = (
            payouts.filter(
                status__in=[PayoutStatus.PENDING, PayoutStatus.APPROVED, PayoutStatus.PAID]
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        available_balance = max(Decimal("0.00"), total_earnings - committed)

        conversion_rate = 0.0
        if total_clicks > 0:
            conversion_rate = round((total_conversions / total_clicks) * 100, 2)

        return {
            "total_links": total_links,
            "total_clicks": total_clicks,
            "total_conversions": total_conversions,
            "conversion_rate_percentage": conversion_rate,
            "total_earnings": str(total_earnings),
            "available_balance": str(available_balance),
            "pending_amount": str(pending_amount),
            "paid_amount": str(paid_amount),
            "currency": "XOF",
        }
