from apps.affiliates.models.click import AffiliateClick
from apps.affiliates.models.link import AffiliateLink
from apps.affiliates.models.payout import PayoutRequest
from apps.affiliates.models.program import AffiliateProgram
from django.contrib import admin


@admin.register(AffiliateProgram)
class AffiliateProgramAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "commission_rate", "cookie_days", "community", "is_active"]
    list_filter = ["is_active"]


@admin.register(AffiliateLink)
class AffiliateLinkAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "code", "custom_slug", "clicks_count", "conversions_count", "total_earnings", "currency", "is_active"]
    search_fields = ["code", "custom_slug", "user__username"]


@admin.register(AffiliateClick)
class AffiliateClickAdmin(admin.ModelAdmin):
    list_display = ["id", "link", "ip_address", "created_at"]


@admin.register(PayoutRequest)
class PayoutRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "amount", "currency", "payout_method", "status", "created_at", "processed_at"]
    list_filter = ["status", "payout_method"]
