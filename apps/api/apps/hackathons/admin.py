from django import forms
from django.contrib import admin, messages
from django.utils.safestring import mark_safe

from apps.hackathons.models import (
    Hackathon,
    HackathonApplication,
    HackathonCriterion,
    HackathonEvaluation,
    HackathonJudge,
    HackathonPrize,
    HackathonSubmission,
    HackathonTeam,
)
from apps.media.services.uploadthing_service import UploadThingService


class PrizeInline(admin.TabularInline):
    model = HackathonPrize
    extra = 1


class CriterionInline(admin.TabularInline):
    model = HackathonCriterion
    extra = 1


class JudgeInline(admin.TabularInline):
    model = HackathonJudge
    extra = 1


class HackathonAdminForm(forms.ModelForm):
    cover_image_file = forms.FileField(
        required=False,
        label="Uploader une Image de Couverture / Bannière (UploadThing)",
        help_text="Sélectionnez une image (JPG, PNG, WebP - max 5 Mo) pour l'héberger directement sur UploadThing.",
    )

    class Meta:
        model = Hackathon
        fields = "__all__"


@admin.register(Hackathon)
class HackathonAdmin(admin.ModelAdmin):
    form = HackathonAdminForm
    list_display = (
        "cover_image_thumbnail",
        "title",
        "community",
        "organizer",
        "format",
        "status",
        "start_time",
        "submission_deadline",
        "results_published",
        "created_at",
    )
    list_filter = ("status", "format", "results_published", "start_time")
    search_fields = ("title", "description", "community__name", "organizer__username")
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("cover_image_preview", "created_at", "updated_at")
    inlines = [PrizeInline, CriterionInline, JudgeInline]

    fieldsets = (
        (
            "Informations Générales",
            {
                "fields": (
                    "community",
                    "organizer",
                    "title",
                    "slug",
                    "tagline",
                    "description",
                    "theme",
                    "main_language",
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
            "Format & Lieu",
            {
                "fields": (
                    "format",
                    "location_url",
                    "venue_name",
                    "venue_address",
                    "venue_city",
                    "venue_country",
                )
            },
        ),
        (
            "Calendrier",
            {
                "fields": (
                    "registration_start",
                    "registration_end",
                    "start_time",
                    "submission_deadline",
                    "judging_end",
                    "results_announced_at",
                    "timezone",
                )
            },
        ),
        (
            "Participation & Règles",
            {
                "fields": (
                    "is_member_only",
                    "allow_teams",
                    "min_team_size",
                    "max_team_size",
                    "max_participants",
                    "auto_accept_applications",
                    "target_audience",
                    "prerequisites",
                    "rules_url",
                    "terms_and_conditions",
                )
            },
        ),
        (
            "Exigences de Soumission",
            {
                "fields": ("require_repo_url", "require_demo_url", "require_video_url")
            },
        ),
        (
            "Statut & Modération",
            {
                "fields": ("status", "is_featured", "results_published", "created_at", "updated_at")
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


@admin.register(HackathonApplication)
class HackathonApplicationAdmin(admin.ModelAdmin):
    list_display = (
        "applicant",
        "hackathon",
        "participation_mode",
        "status",
        "reviewed_at",
        "created_at",
    )
    list_filter = ("status", "participation_mode")
    search_fields = ("applicant__username", "hackathon__title")


@admin.register(HackathonTeam)
class HackathonTeamAdmin(admin.ModelAdmin):
    list_display = ("name", "hackathon", "leader", "created_at")
    search_fields = ("name", "hackathon__title", "leader__username")


@admin.register(HackathonSubmission)
class HackathonSubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "hackathon",
        "applicant",
        "team",
        "status",
        "is_final",
        "total_score",
        "rank",
        "submitted_at",
    )
    list_filter = ("status", "is_final", "rank")
    search_fields = ("title", "hackathon__title", "applicant__username", "team__name")


@admin.register(HackathonEvaluation)
class HackathonEvaluationAdmin(admin.ModelAdmin):
    list_display = (
        "submission",
        "judge",
        "weighted_score",
        "is_submitted",
        "submitted_at",
    )
    list_filter = ("is_submitted",)
    search_fields = ("submission__title", "judge__username")
