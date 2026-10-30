from django.contrib import admin

from apps.billing.models.affiliate import Affiliate, AffiliateCommission
from apps.billing.models.payment import Payment
from apps.billing.models.plan import Plan
from apps.billing.models.subscription import Subscription
from apps.billing.models.wallet import CommunityPayout, CommunityWallet
from common.permissions.base import is_superadmin_user


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    """
    Interface Django Admin permettant au Superadmin de modifier directement
    le montant de l'abonnement mensuel (5 000 FCFA par défaut) en ligne ou dans la fiche.
    """
    list_display = (
        'name',
        'slug',
        'price',
        'currency',
        'billing_interval',
        'community',
        'is_active',
        'order',
        'updated_at',
    )
    list_editable = ('price', 'is_active', 'order')
    list_filter = ('billing_interval', 'is_active', 'currency')
    search_fields = ('name', 'slug', 'description')
    readonly_fields = ('id', 'created_at', 'updated_at')

    def has_change_permission(self, request, obj=None):
        if obj is not None and obj.community_id is None:
            return bool(request.user and request.user.is_authenticated and (request.user.is_superuser or is_superadmin_user(request.user)))
        return super().has_change_permission(request, obj=obj)

    def has_delete_permission(self, request, obj=None):
        if obj is not None and obj.community_id is None:
            return bool(request.user and request.user.is_authenticated and (request.user.is_superuser or is_superadmin_user(request.user)))
        return super().has_delete_permission(request, obj=obj)


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'plan', 'community', 'status', 'current_period_start', 'current_period_end', 'cancel_at_period_end')
    list_filter = ('status', 'cancel_at_period_end', 'current_period_end')
    search_fields = ('user__username', 'user__email', 'plan__name')


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'plan', 'amount', 'platform_fee', 'net_amount', 'currency', 'status', 'provider', 'referral_code', 'paid_at', 'created_at')
    list_filter = ('status', 'provider', 'currency', 'created_at')
    search_fields = ('id', 'user__username', 'user__email', 'provider_token', 'provider_reference', 'referral_code')


@admin.register(CommunityWallet)
class CommunityWalletAdmin(admin.ModelAdmin):
    list_display = ('community', 'total_gross', 'total_platform_fees', 'total_net', 'available_balance', 'withdrawn_amount', 'currency')
    search_fields = ('community__name', 'community__slug')


@admin.register(CommunityPayout)
class CommunityPayoutAdmin(admin.ModelAdmin):
    list_display = ('id', 'community', 'requested_by', 'amount', 'currency', 'status', 'payment_method', 'account_identifier', 'created_at')
    list_filter = ('status', 'payment_method', 'currency', 'created_at')
    search_fields = ('community__name', 'requested_by__username', 'account_identifier', 'reference')


@admin.register(Affiliate)
class AffiliateAdmin(admin.ModelAdmin):
    list_display = ('user', 'referral_code', 'commission_rate', 'total_earnings', 'balance', 'is_active')
    search_fields = ('user__username', 'referral_code')


@admin.register(AffiliateCommission)
class AffiliateCommissionAdmin(admin.ModelAdmin):
    list_display = ('affiliate', 'referred_user', 'payment', 'amount', 'currency', 'status', 'created_at')
    list_filter = ('status', 'currency', 'created_at')
    search_fields = ('affiliate__user__username', 'referred_user__username', 'payment__id')
