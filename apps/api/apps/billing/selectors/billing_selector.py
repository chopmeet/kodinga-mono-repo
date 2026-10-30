from collections import defaultdict
from decimal import Decimal
from typing import Optional

from django.db.models import QuerySet
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied

from apps.accounts.models.user import User
from apps.billing.models.affiliate import Affiliate, AffiliateCommission
from apps.billing.models.payment import Payment, PaymentStatus
from apps.billing.models.plan import Plan
from apps.billing.models.subscription import Subscription, SubscriptionStatus
from apps.billing.models.wallet import CommunityPayout, CommunityWallet
from apps.communities.models.community import Community
from common.permissions.base import is_superadmin_user


class BillingSelector:
    """
    Optimized database queries for plans, active subscriptions, payment history,
    and community creator financial analytics.
    """

    @classmethod
    def get_active_plans(cls, community_slug: Optional[str] = None) -> QuerySet[Plan]:
        qs = Plan.objects.filter(is_active=True).select_related('community')
        if community_slug:
            import uuid
            try:
                qs = qs.filter(community_id=uuid.UUID(str(community_slug)))
            except (ValueError, TypeError):
                qs = qs.filter(community__slug=community_slug)
        else:
            # Platform Pro plans
            qs = qs.filter(community__isnull=True)
        return qs.order_by('order', 'price')

    @classmethod
    def get_user_subscriptions(cls, user: User) -> QuerySet[Subscription]:
        return Subscription.objects.filter(user=user).select_related('plan', 'community').order_by('-current_period_end')

    @classmethod
    def get_user_payments(cls, user: User) -> QuerySet[Payment]:
        return Payment.objects.filter(user=user).select_related('plan', 'subscription').order_by('-created_at')

    @classmethod
    def get_payment_for_user(cls, payment_id: str, user: User) -> Payment:
        try:
            payment = Payment.objects.select_related('plan', 'plan__community', 'subscription').get(id=payment_id)
        except Payment.DoesNotExist as err:
            raise NotFound("Paiement introuvable.") from err

        if not is_superadmin_user(user) and payment.user_id != user.id:
            raise PermissionDenied("Vous n'avez pas l'autorisation d'accéder à ce paiement.")

        return payment

    @classmethod
    def get_affiliate_profile(cls, user: User) -> Optional[Affiliate]:
        return Affiliate.objects.filter(user=user).first()

    @classmethod
    def get_affiliate_commissions(cls, affiliate: Affiliate) -> QuerySet[AffiliateCommission]:
        return AffiliateCommission.objects.filter(affiliate=affiliate).select_related('referred_user', 'payment').order_by('-created_at')

    @classmethod
    def get_community_for_creator(cls, community_slug: str, user: User) -> Community:
        """
        Validates that community exists and user has administrative ownership rights.
        """
        try:
            community = Community.objects.get(slug=community_slug)
        except Community.DoesNotExist as err:
            raise NotFound(f"Communauté '{community_slug}' introuvable.") from err

        if not is_superadmin_user(user) and community.owner_id != user.id:
            raise PermissionDenied("Seul le créateur ou l'administrateur de cette communauté peut consulter ses données financières.")

        return community

    @classmethod
    def get_community_subscribers(cls, community: Community) -> QuerySet[Subscription]:
        return Subscription.objects.filter(
            community=community
        ).select_related('user', 'plan').order_by('-created_at')

    @classmethod
    def get_community_payments(cls, community: Community) -> QuerySet[Payment]:
        return Payment.objects.filter(
            plan__community=community
        ).select_related('user', 'plan').order_by('-created_at')

    @classmethod
    def get_community_revenue_overview(cls, community: Community) -> dict:
        wallet, _ = CommunityWallet.objects.get_or_create(community=community)

        # Count current active subscribers
        now = timezone.now()
        active_subscribers_count = Subscription.objects.filter(
            community=community,
            status=SubscriptionStatus.ACTIVE,
            current_period_end__gt=now
        ).values('user_id').distinct().count()

        # Aggregate monthly payments for chart
        paid_payments = Payment.objects.filter(
            plan__community=community,
            status=PaymentStatus.PAID
        ).order_by('paid_at', 'created_at')

        monthly_dict = defaultdict(lambda: {'gross': Decimal('0.00'), 'fees': Decimal('0.00'), 'net': Decimal('0.00'), 'count': 0})

        for p in paid_payments:
            date_ref = p.paid_at or p.created_at
            month_key = date_ref.strftime('%Y-%m')
            entry = monthly_dict[month_key]
            entry['gross'] += p.amount
            entry['fees'] += p.platform_fee
            entry['net'] += p.net_amount
            entry['count'] += 1

        monthly_revenue = [
            {
                'month': m,
                'gross': vals['gross'],
                'fees': vals['fees'],
                'net': vals['net'],
                'payments_count': vals['count']
            }
            for m, vals in sorted(monthly_dict.items())
        ]

        return {
            'total_gross': wallet.total_gross,
            'total_platform_fees': wallet.total_platform_fees,
            'total_net': wallet.total_net,
            'available_balance': wallet.available_balance,
            'withdrawn_amount': wallet.withdrawn_amount,
            'currency': wallet.currency,
            'active_subscribers_count': active_subscribers_count,
            'monthly_revenue': monthly_revenue
        }

    @classmethod
    def get_community_payouts(cls, community: Community) -> QuerySet[CommunityPayout]:
        return CommunityPayout.objects.filter(community=community).order_by('-created_at')
