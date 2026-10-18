from django.contrib import admin

from apps.billing.models.affiliate import Affiliate, AffiliateCommission
from apps.billing.models.payment import Payment
from apps.billing.models.plan import Plan
from apps.billing.models.subscription import Subscription


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'price', 'currency', 'billing_interval', 'community', 'is_active', 'order')
    list_filter = ('billing_interval', 'is_active', 'currency')
    search_fields = ('name', 'slug', 'description')


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'plan', 'community', 'status', 'current_period_start', 'current_period_end', 'cancel_at_period_end')
    list_filter = ('status', 'cancel_at_period_end', 'current_period_end')
    search_fields = ('user__username', 'user__email', 'plan__name')


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'plan', 'amount', 'currency', 'status', 'provider', 'provider_token', 'paid_at', 'created_at')
    list_filter = ('status', 'provider', 'currency', 'created_at')
    search_fields = ('id', 'user__username', 'user__email', 'provider_token', 'provider_reference')


@admin.register(Affiliate)
class AffiliateAdmin(admin.ModelAdmin):
    list_display = ('user', 'referral_code', 'commission_rate', 'total_earnings', 'balance', 'is_active')
    search_fields = ('user__username', 'referral_code')


@admin.register(AffiliateCommission)
class AffiliateCommissionAdmin(admin.ModelAdmin):
    list_display = ('affiliate', 'referred_user', 'payment', 'amount', 'currency', 'status', 'created_at')
    list_filter = ('status', 'currency', 'created_at')
    search_fields = ('affiliate__user__username', 'referred_user__username', 'payment__id')
