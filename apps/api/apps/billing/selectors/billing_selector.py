from typing import Optional
from django.db.models import QuerySet
from rest_framework.exceptions import PermissionDenied, NotFound
from common.permissions.base import is_superadmin_user
from apps.accounts.models.user import User
from apps.billing.models.affiliate import Affiliate, AffiliateCommission
from apps.billing.models.payment import Payment
from apps.billing.models.plan import Plan
from apps.billing.models.subscription import Subscription


class BillingSelector:
    """
    Optimized database queries for plans, active subscriptions, and payment history.
    """

    @classmethod
    def get_active_plans(cls, community_slug: Optional[str] = None) -> QuerySet[Plan]:
        qs = Plan.objects.filter(is_active=True).select_related('community')
        if community_slug:
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
            payment = Payment.objects.select_related('plan', 'subscription').get(id=payment_id)
        except Payment.DoesNotExist:
            raise NotFound("Paiement introuvable.")

        if not is_superadmin_user(user) and payment.user_id != user.id:
            raise PermissionDenied("Vous n'avez pas l'autorisation d'accéder à ce paiement.")

        return payment

    @classmethod
    def get_affiliate_profile(cls, user: User) -> Optional[Affiliate]:
        return Affiliate.objects.filter(user=user).first()

    @classmethod
    def get_affiliate_commissions(cls, affiliate: Affiliate) -> QuerySet[AffiliateCommission]:
        return AffiliateCommission.objects.filter(affiliate=affiliate).select_related('referred_user', 'payment').order_by('-created_at')
