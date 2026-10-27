from django import forms
from django.contrib import admin, messages
from django.utils.safestring import mark_safe

from apps.events.models.attendee import EventAttendee
from apps.events.models.event import Event
from apps.media.services.uploadthing_service import UploadThingService


class EventAdminForm(forms.ModelForm):
    cover_image_file = forms.FileField(
        required=False,
        label="Uploader une Image de Couverture / Bannière (UploadThing)",
        help_text="Sélectionnez une image (JPG, PNG, WebP - max 5 Mo) pour l'héberger directement sur UploadThing.",
    )

    class Meta:
        model = Event
        fields = "__all__"


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    form = EventAdminForm
    list_display = (
        "cover_image_thumbnail",
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
    readonly_fields = ("cover_image_preview", "attendees_count", "created_at", "updated_at")

    fieldsets = (
        (
            "Informations Générales",
            {
                "fields": (
                    "community",
                    "host",
                    "title",
                    "slug",
                    "description",
                    "event_type",
                    "format",
                    "status",
                )
            },
        ),
        (
            "Bannière & Visuel (UploadThing)",
            {
                "description": "Vous pouvez téléverser un fichier local (hébergé en dur sur UploadThing) ou coller une URL directe.",
                "fields": ("cover_image_file", "cover_image_url", "cover_image_preview"),
            },
        ),
        (
            "Date & Heure",
            {
                "fields": ("start_time", "end_time", "timezone")
            },
        ),
        (
            "Lieu & Accès",
            {
                "fields": (
                    "location_url",
                    "venue_name",
                    "location_address",
                    "location_city",
                    "location_country",
                    "max_attendees",
                )
            },
        ),
        (
            "Options LiveKit & Visibilité",
            {
                "fields": (
                    "live_room_name",
                    "is_recorded",
                    "replay_video_asset",
                    "is_public",
                    "metadata",
                    "attendees_count",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    def cover_image_thumbnail(self, obj):
        if obj and obj.cover_image_url:
            return mark_safe(
                f'<img src="{obj.cover_image_url}" style="width: 48px; height: 28px; object-fit: cover; border-radius: 4px;" />'
            )
        return mark_safe('<span style="color: #999;">—</span>')

    cover_image_thumbnail.short_description = "Bannière"

    def cover_image_preview(self, obj):
        if obj and obj.cover_image_url:
            return mark_safe(
                f'<div style="margin-top: 5px;">'
                f'<a href="{obj.cover_image_url}" target="_blank" rel="noopener noreferrer">'
                f'<img src="{obj.cover_image_url}" style="max-height: 120px; max-width: 320px; border-radius: 8px; border: 1px solid #ddd; object-fit: cover; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" />'
                f'</a>'
                f'<br><small style="color: #666;">Cliquer pour ouvrir ({obj.cover_image_url})</small>'
                f'</div>'
            )
        return "Aucune image de couverture définie."

    cover_image_preview.short_description = "Aperçu de la Bannière"

    def save_model(self, request, obj, form, change):
        cover_image_file = form.cleaned_data.get("cover_image_file")
        if cover_image_file:
            try:
                res = UploadThingService.upload_file_direct(
                    user=request.user,
                    file_name=cover_image_file.name,
                    file_bytes=cover_image_file.read(),
                    mime_type=getattr(cover_image_file, "content_type", "image/png") or "image/png",
                    purpose="banner",
                )
                obj.cover_image_url = res["file_url"]
                self.message_user(
                    request,
                    f"Bannière téléversée sur UploadThing avec succès : {res['file_url']}",
                    messages.SUCCESS,
                )
            except Exception as e:
                self.message_user(
                    request,
                    f"Échec du téléversement de la bannière sur UploadThing : {e}",
                    messages.ERROR,
                )

        super().save_model(request, obj, form, change)


@admin.register(EventAttendee)
class EventAttendeeAdmin(admin.ModelAdmin):
    list_display = ("event", "user", "status", "checked_in_at", "created_at")
    list_filter = ("status", "checked_in_at")
    search_fields = ("event__title", "user__username", "user__email")
    readonly_fields = ("created_at", "updated_at")
