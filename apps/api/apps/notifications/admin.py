from django.contrib import admin

from apps.notifications.models.notification import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = (
        "recipient",
        "actor",
        "notification_type",
        "title",
        "is_read",
        "created_at",
    )
    list_filter = ("notification_type", "is_read", "created_at")
    search_fields = (
        "recipient__username",
        "recipient__email",
        "title",
        "body",
    )
