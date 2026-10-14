from django.contrib import admin

from apps.events.models.attendee import EventAttendee
from apps.events.models.event import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "community",
        "host",
        "event_type",
        "format",
        "status",
        "start_time",
        "attendees_count",
        "max_attendees",
    )
    list_filter = ("event_type", "format", "status", "start_time")
    search_fields = ("title", "description", "community__name", "host__username")
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("attendees_count", "created_at", "updated_at")


@admin.register(EventAttendee)
class EventAttendeeAdmin(admin.ModelAdmin):
    list_display = ("event", "user", "status", "checked_in_at", "created_at")
    list_filter = ("status", "checked_in_at")
    search_fields = ("event__title", "user__username", "user__email")
    readonly_fields = ("created_at", "updated_at")
