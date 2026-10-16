from django.contrib import admin

from apps.gamification.models.badge import Badge, UserBadge
from apps.gamification.models.reputation import (
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
    list_display = ("user", "action", "points", "community", "created_at")
    list_filter = ("action", "created_at")
    search_fields = ("user__username", "description")
