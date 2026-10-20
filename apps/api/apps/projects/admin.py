from django import forms
from django.contrib import admin, messages
from django.utils.safestring import mark_safe

from apps.media.services.uploadthing_service import UploadThingService
from apps.projects.models.comment import ProjectComment
from apps.projects.models.project import Project
from apps.projects.models.upvote import ProjectUpvote


class ProjectAdminForm(forms.ModelForm):
    cover_image_file = forms.FileField(
        required=False,
        label="Uploader une Image de Couverture / Bannière (UploadThing)",
        help_text="Sélectionnez une image (JPG, PNG, WebP - max 10 Mo) pour l'héberger sur UploadThing.",
    )

    class Meta:
        model = Project
        fields = "__all__"


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    form = ProjectAdminForm
    list_display = [
        "cover_image_thumbnail",
        "title",
        "owner",
        "community",
        "status",
        "demo_images_count",
        "upvotes_count",
        "views_count",
        "is_featured",
        "created_at",
    ]
    list_filter = ["status", "is_featured", "created_at"]
    search_fields = ["title", "tagline", "description", "owner__username"]
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("cover_image_preview", "demo_images_preview", "created_at", "updated_at")

    fieldsets = (
        (
            "Informations Générales",
            {
                "fields": (
                    "owner",
                    "community",
                    "title",
                    "slug",
                    "tagline",
                    "description",
                    "technologies",
                    "status",
                    "is_featured",
                )
            },
        ),
        (
            "Bannière & Image de couverture (UploadThing)",
            {
                "description": "Téléversez une image de couverture ou collez une URL directe.",
                "fields": ("cover_image_file", "cover_image_url", "cover_image_preview"),
            },
        ),
        (
            "Images / Captures d'écran Démo",
            {
                "description": "Liste d'URLs des captures d'écran et aperçus de démo du projet.",
                "fields": ("demo_images", "demo_images_preview"),
            },
        ),
        (
            "Liens externes",
            {
                "fields": ("demo_url", "repository_url"),
            },
        ),
        (
            "Métriques & Horodatages",
            {
                "classes": ("collapse",),
                "fields": ("upvotes_count", "views_count", "created_at", "updated_at"),
            },
        ),
    )

    def cover_image_thumbnail(self, obj):
        if obj and obj.cover_image_url:
            return mark_safe(
                f'<img src="{obj.cover_image_url}" style="width: 48px; height: 28px; object-fit: cover; border-radius: 4px;" />'
            )
        return mark_safe('<span style="color: #999;">—</span>')

    cover_image_thumbnail.short_description = "Couverture"

    def demo_images_count(self, obj):
        count = len(obj.demo_images) if obj and obj.demo_images else 0
        return f"{count} démo(s)" if count else "—"

    demo_images_count.short_description = "Démos"

    def cover_image_preview(self, obj):
        if obj and obj.cover_image_url:
            return mark_safe(
                f'<div style="margin-top: 5px;">'
                f'<a href="{obj.cover_image_url}" target="_blank" rel="noopener noreferrer">'
                f'<img src="{obj.cover_image_url}" style="max-height: 120px; max-width: 320px; border-radius: 8px; border: 1px solid #ddd; object-fit: cover;" />'
                f'</a>'
                f'<br><small style="color: #666;">Cliquer pour ouvrir ({obj.cover_image_url})</small>'
                f'</div>'
            )
        return "Aucune image de couverture définie."

    cover_image_preview.short_description = "Aperçu de la Couverture"

    def demo_images_preview(self, obj):
        if not obj or not obj.demo_images:
            return "Aucune image de démonstration."
        html = ['<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 5px;">']
        for url in obj.demo_images:
            html.append(
                f'<a href="{url}" target="_blank" rel="noopener noreferrer">'
                f'<img src="{url}" style="height: 80px; width: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #ddd;" />'
                f'</a>'
            )
        html.append('</div>')
        return mark_safe(''.join(html))

    demo_images_preview.short_description = "Aperçu des Images Démo"

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
                    f"Image de couverture téléversée sur UploadThing avec succès : {res['file_url']}",
                    messages.SUCCESS,
                )
            except Exception as e:
                self.message_user(
                    request,
                    f"Échec du téléversement sur UploadThing : {e}",
                    messages.ERROR,
                )

        super().save_model(request, obj, form, change)


@admin.register(ProjectUpvote)
class ProjectUpvoteAdmin(admin.ModelAdmin):
    list_display = ["id", "project", "user", "created_at"]


@admin.register(ProjectComment)
class ProjectCommentAdmin(admin.ModelAdmin):
    list_display = ["id", "project", "author", "parent", "created_at"]
