from django.contrib import admin

from apps.gamification.models.badge import Badge, UserBadge
from apps.gamification.models.reputation import (
    CommunityPointRule,
    CommunityPointRuleAuditLog,
    ReputationTransaction,
    UserReputation,
)


@admin.register(Badge)
class BadgeAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "category", "points_reward", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("name", "slug", "description")


@admin.register(UserBadge)
class UserBadgeAdmin(admin.ModelAdmin):
    list_display = ("user", "badge", "community", "awarded_at")
    list_filter = ("badge__category", "awarded_at")
    search_fields = ("user__username", "badge__name")


@admin.register(UserReputation)
class UserReputationAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "total_points",
        "level",
        "rank_title",
        "current_streak_days",
    )
    search_fields = ("user__username", "user__email")
    ordering = ("-total_points",)


@admin.register(ReputationTransaction)
class ReputationTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "action",
        "points",
        "source",
        "community",
        "reference_type",
        "reference_id",
        "awarded_by",
        "created_at",
    )
    list_filter = ("action", "source", "created_at")
    search_fields = (
        "user__username",
        "description",
        "reference_id",
        "idempotency_key",
    )


@admin.register(CommunityPointRule)
class CommunityPointRuleAdmin(admin.ModelAdmin):
    list_display = (
        "community",
        "action",
        "label",
        "points",
        "is_active",
        "updated_by",
        "updated_at",
    )
    list_filter = ("action", "is_active")
    search_fields = ("community__name", "community__slug", "label")


@admin.register(CommunityPointRuleAuditLog)
class CommunityPointRuleAuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "community",
        "action",
        "previous_points",
        "new_points",
        "previous_is_active",
        "new_is_active",
        "changed_by",
        "created_at",
    )
    list_filter = ("action", "created_at")
    search_fields = ("community__name", "community__slug", "note")
