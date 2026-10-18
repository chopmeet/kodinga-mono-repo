import uuid

from django import forms
from django.contrib import admin, messages
from django.utils import timezone
from django.utils.safestring import mark_safe

from apps.classroom.models.course import Course
from apps.classroom.models.lesson import Lesson, LessonType
from apps.classroom.models.module import CourseModule
from apps.classroom.models.progress import CourseEnrollment, LessonProgress
from apps.media.services.mux_service import MuxVideoService
from apps.media.services.uploadthing_service import UploadThingService


class CourseAdminForm(forms.ModelForm):
    thumbnail_file = forms.FileField(
        required=False,
        label="Uploader une Miniature / Thumbnail (UploadThing)",
        help_text="Sélectionnez une image (JPG, PNG, WebP - max 5 Mo) pour l'héberger directement sur UploadThing.",
    )

    class Meta:
        model = Course
        fields = '__all__'


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    form = CourseAdminForm
    list_display = (
        'thumbnail_tag',
        'title',
        'community',
        'author',
        'level',
        'is_published',
        'is_sequential',
        'order',
        'lessons_count',
        'created_at',
    )
    list_filter = ('is_published', 'is_sequential', 'level', 'created_at')
    search_fields = ('title', 'slug', 'description', 'community__name')
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ('thumbnail_preview', 'created_at', 'updated_at')

    fieldsets = (
        ("Informations Générales", {
            "fields": ("community", "author", "title", "slug", "description", "level")
        }),
        ("Miniature / Visuel (UploadThing)", {
            "description": "Téléversez une miniature stockée sur UploadThing ou renseignez une URL directe.",
            "fields": ("thumbnail_file", "thumbnail_url", "thumbnail_preview"),
        }),
        ("Publication & Navigation", {
            "fields": ("is_published", "is_sequential", "order")
        }),
        ("Statistiques", {
            "classes": ("collapse",),
            "fields": ("modules_count", "lessons_count", "duration_seconds", "created_at", "updated_at"),
        }),
    )

    def thumbnail_tag(self, obj):
        if obj and obj.thumbnail_url:
            return mark_safe(f'<img src="{obj.thumbnail_url}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 6px;" />')
        return mark_safe('<span style="color: #94a3b8;">—</span>')
    thumbnail_tag.short_description = "Aperçu"

    def thumbnail_preview(self, obj):
        if obj and obj.thumbnail_url:
            return mark_safe(
                f'<div style="margin-top: 5px;">'
                f'<a href="{obj.thumbnail_url}" target="_blank" rel="noopener noreferrer">'
                f'<img src="{obj.thumbnail_url}" style="max-height: 120px; max-width: 300px; border-radius: 8px; border: 1px solid #cbd5e1; object-fit: cover;" />'
                f'</a><br><small style="color: #64748b;">Cliquer pour ouvrir en taille réelle</small>'
                f'</div>'
            )
        return "Aucune miniature définie."
    thumbnail_preview.short_description = "Aperçu Miniature"

    def save_model(self, request, obj, form, change):
        thumbnail_file = form.cleaned_data.get('thumbnail_file')
        if thumbnail_file:
            try:
                res = UploadThingService.upload_file_direct(
                    user=request.user,
                    file_name=thumbnail_file.name,
                    file_bytes=thumbnail_file.read(),
                    mime_type=getattr(thumbnail_file, 'content_type', 'image/jpeg') or 'image/jpeg',
                    purpose='course_thumbnail',
                )
                obj.thumbnail_url = res['file_url']
                self.message_user(
                    request,
                    f"Miniature de cours téléversée avec succès sur UploadThing : {res['file_url']}",
                    messages.SUCCESS,
                )
            except Exception as e:
                self.message_user(request, f"Échec de l'upload de la miniature : {e}", messages.ERROR)

        super().save_model(request, obj, form, change)


@admin.register(CourseModule)
class CourseModuleAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'order', 'lessons_count', 'created_at')
    list_filter = ('course__community', 'created_at')
    search_fields = ('title', 'course__title')


class LessonAdminForm(forms.ModelForm):
    video_file = forms.FileField(
        required=False,
        label="Téléverser une Vidéo (UploadThing + Mux)",
        help_text="Sélectionnez une vidéo (MP4, MOV, WebM, etc.). Elle sera stockée de façon brute sur UploadThing (stockage permanent) et envoyée à Mux pour un streaming HLS adaptatif instantané.",
    )
    attachment_file = forms.FileField(
        required=False,
        label="Ajouter un Document / Fichier joint (UploadThing)",
        help_text="Sélectionnez un fichier (PDF, code source, archive ZIP, aide-mémoire). Il sera stocké en dur sur UploadThing et répertorié dans les pièces jointes de la leçon.",
    )
    cover_image_file = forms.FileField(
        required=False,
        label="Image de Couverture (UploadThing)",
        help_text="Sélectionnez une image d'en-tête (JPG, PNG, WebP) qui sera hébergée sur UploadThing.",
    )

    class Meta:
        model = Lesson
        fields = '__all__'


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    form = LessonAdminForm
    list_display = (
        'title',
        'module',
        'lesson_type',
        'duration_seconds',
        'order',
        'is_free_preview',
        'video_status_display',
        'attachments_count',
        'created_at',
    )
    list_filter = ('lesson_type', 'is_free_preview', 'created_at', 'module__course__community')
    search_fields = ('title', 'slug', 'module__title', 'module__course__title')
    readonly_fields = ('video_preview', 'attachments_preview', 'cover_preview', 'created_at', 'updated_at')

    fieldsets = (
        ("Informations Générales", {
            "fields": (
                "module",
                "title",
                "slug",
                "lesson_type",
                "order",
                "is_free_preview",
                "duration_seconds",
            )
        }),
        ("Vidéo de la leçon (UploadThing + Mux)", {
            "description": "Téléversez un fichier vidéo local : il sera stocké de manière brute sur UploadThing (stockage permanent) et automatiquement ingéré dans Mux pour un streaming HLS adaptatif mondial ultra-rapide.",
            "fields": (
                "video_file",
                "video_asset",
                "video_preview",
            )
        }),
        ("Fichiers joints & Documents à télécharger (UploadThing)", {
            "description": "Téléversez des fichiers (PDF, exercices, archives ZIP, code source). Ils sont hébergés sur le CDN UploadThing et répertoriés dans la base de données pour les apprenants.",
            "fields": (
                "attachment_file",
                "attachments_preview",
                "attachments",
            )
        }),
        ("Image de couverture (UploadThing)", {
            "fields": (
                "cover_image_file",
                "cover_image_url",
                "cover_preview",
            )
        }),
        ("Contenu pédagogique", {
            "fields": (
                "content_format",
                "content",
                "images",
            )
        }),
        ("Métadonnées & Dates", {
            "classes": ("collapse",),
            "fields": ("created_at", "updated_at"),
        }),
    )

    def video_status_display(self, obj):
        if obj and obj.video_asset:
            status = obj.video_asset.status
            color = "#16a34a" if status == "ready" else "#ea580c"
            return mark_safe(f'<span style="color: {color}; font-weight: bold;">● {status}</span>')
        return mark_safe('<span style="color: #94a3b8;">—</span>')
    video_status_display.short_description = "Vidéo Mux"

    def attachments_count(self, obj):
        count = len(obj.attachments) if obj and obj.attachments else 0
        if count > 0:
            return mark_safe(f'<span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: 600;">📎 {count}</span>')
        return "0"
    attachments_count.short_description = "Fichiers"

    def video_preview(self, obj):
        if not obj or not obj.video_asset:
            return "Aucune vidéo associée actuellement."
        va = obj.video_asset
        source_url = ""
        if isinstance(va.metadata, dict):
            source_url = va.metadata.get('source_url', '')

        html = [
            '<div style="padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; max-width: 650px; font-family: sans-serif;">',
            f'<div style="margin-bottom: 8px;"><strong>Mux Asset ID :</strong> <code>{va.asset_id or "—"}</code></div>',
            f'<div style="margin-bottom: 8px;"><strong>Mux Playback ID :</strong> <code>{va.playback_id or "—"}</code></div>',
            f'<div style="margin-bottom: 8px;"><strong>Statut Mux :</strong> <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: #dcfce7; color: #166534; font-weight: 600;">{va.status}</span></div>',
        ]
        if va.duration:
            mins = int(va.duration // 60)
            secs = int(va.duration % 60)
            html.append(f'<div style="margin-bottom: 8px;"><strong>Durée :</strong> {mins}m {secs:02d}s ({va.duration}s)</div>')

        if obj.video_hls_url:
            html.append(f'<div style="margin-bottom: 8px;"><strong>Flux HLS Mux :</strong> <a href="{obj.video_hls_url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; word-break: break-all;">{obj.video_hls_url}</a></div>')

        if source_url:
            html.append(f'<div style="margin-bottom: 8px;"><strong>Fichier brut UploadThing :</strong> <a href="{source_url}" target="_blank" rel="noopener noreferrer" style="color: #059669; word-break: break-all;">{source_url}</a></div>')

        if va.playback_id:
            thumb_url = f"https://image.mux.com/{va.playback_id}/thumbnail.webp?width=600"
            html.append(
                f'<div style="margin-top: 10px;">'
                f'<a href="{obj.video_hls_url or source_url}" target="_blank" rel="noopener noreferrer">'
                f'<img src="{thumb_url}" alt="Aperçu vidéo" style="max-width: 100%; border-radius: 6px; border: 1px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.08);" />'
                f'</a>'
                f'<br><small style="color: #64748b;">Miniature dynamique générée par Mux (cliquer pour voir la vidéo)</small>'
                f'</div>'
            )
        html.append('</div>')
        return mark_safe(''.join(html))
    video_preview.short_description = "Aperçu de la Vidéo"

    def attachments_preview(self, obj):
        if not obj or not obj.attachments:
            return "Aucun fichier joint actuellement."

        items_html = []
        for att in obj.attachments:
            name = att.get('name', 'Fichier sans nom')
            url = att.get('url', '#')
            size = att.get('size', 0)
            mime = att.get('mime_type', 'application/octet-stream')

            size_str = ""
            if isinstance(size, (int, float)) and size > 0:
                if size >= 1024 * 1024:
                    size_str = f"({size / (1024 * 1024):.2f} Mo)"
                else:
                    size_str = f"({size / 1024:.1f} Ko)"

            items_html.append(
                f'<li style="margin-bottom: 8px; padding: 8px 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">'
                f'<div style="display: flex; align-items: center; justify-content: space-between;">'
                f'<div>'
                f'<strong>📄 {name}</strong> <span style="color: #64748b; font-size: 0.85em;">{size_str}</span>'
                f'<br><small style="color: #94a3b8;">Type : {mime}</small>'
                f'</div>'
                f'<a href="{url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 4px 10px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 0.85em; font-weight: 500;">'
                f'📥 Télécharger (UploadThing)'
                f'</a>'
                f'</div>'
                f'</li>'
            )

        return mark_safe(f'<ul style="list-style: none; padding-left: 0; margin-top: 5px; max-width: 650px;">{"".join(items_html)}</ul>')
    attachments_preview.short_description = "Documents joints enregistrés"

    def cover_preview(self, obj):
        if obj and obj.cover_image_url:
            return mark_safe(
                f'<div style="margin-top: 5px;">'
                f'<a href="{obj.cover_image_url}" target="_blank" rel="noopener noreferrer">'
                f'<img src="{obj.cover_image_url}" style="max-height: 120px; max-width: 320px; border-radius: 8px; border: 1px solid #ddd; object-fit: cover;" />'
                f'</a>'
                f'<br><small style="color: #666;">Cliquer pour ouvrir en grand</small>'
                f'</div>'
            )
        return "Aucune image de couverture définie."
    cover_preview.short_description = "Aperçu Couverture"

    def save_model(self, request, obj, form, change):
        # 1. Image de couverture via UploadThing
        cover_image_file = form.cleaned_data.get('cover_image_file')
        if cover_image_file:
            try:
                res_cover = UploadThingService.upload_file_direct(
                    user=request.user,
                    file_name=cover_image_file.name,
                    file_bytes=cover_image_file.read(),
                    mime_type=getattr(cover_image_file, 'content_type', 'image/jpeg') or 'image/jpeg',
                    purpose='classroom_cover',
                )
                obj.cover_image_url = res_cover['file_url']
                self.message_user(
                    request,
                    f"Image de couverture téléversée avec succès sur UploadThing : {res_cover['file_url']}",
                    messages.SUCCESS,
                )
            except Exception as e:
                self.message_user(request, f"Erreur lors de l'upload de l'image de couverture : {e}", messages.ERROR)

        # 2. Vidéo : Stockage UploadThing brut + Ingestion Mux
        video_file = form.cleaned_data.get('video_file')
        if video_file:
            try:
                # Étape 1 : Stockage sur UploadThing
                res_ut = UploadThingService.upload_file_direct(
                    user=request.user,
                    file_name=video_file.name,
                    file_bytes=video_file.read(),
                    mime_type=getattr(video_file, 'content_type', 'video/mp4') or 'video/mp4',
                    purpose='general',
                )
                raw_url = res_ut['file_url']

                # Étape 2 : Création de l'asset de streaming Mux
                video_asset = MuxVideoService.create_asset_from_url(
                    user=request.user,
                    input_url=raw_url,
                    title=f"{obj.title or 'Leçon'} (Vidéo)",
                    description=f"Module : {obj.module.title if obj.module else ''} | Leçon : {obj.title}",
                )
                obj.video_asset = video_asset
                obj.lesson_type = LessonType.VIDEO
                if video_asset.duration and not obj.duration_seconds:
                    obj.duration_seconds = int(video_asset.duration)

                self.message_user(
                    request,
                    f"Vidéo téléversée sur UploadThing ({raw_url}) et envoyée à Mux (Asset: {video_asset.asset_id}, Playback: {video_asset.playback_id}) avec succès.",
                    messages.SUCCESS,
                )
            except Exception as e:
                self.message_user(request, f"Erreur lors du traitement vidéo : {e}", messages.ERROR)

        # 3. Fichier joint / Pièce jointe via UploadThing
        attachment_file = form.cleaned_data.get('attachment_file')
        if attachment_file:
            try:
                res_att = UploadThingService.upload_file_direct(
                    user=request.user,
                    file_name=attachment_file.name,
                    file_bytes=attachment_file.read(),
                    mime_type=getattr(attachment_file, 'content_type', 'application/octet-stream') or 'application/octet-stream',
                    purpose='lesson_attachment',
                )
                att_item = {
                    'id': str(uuid.uuid4()),
                    'name': attachment_file.name,
                    'url': res_att['file_url'],
                    'size': res_att.get('file_size') or getattr(attachment_file, 'size', 0),
                    'mime_type': getattr(attachment_file, 'content_type', 'application/octet-stream') or 'application/octet-stream',
                    'uploaded_at': timezone.now().isoformat(),
                }
                current_attachments = list(obj.attachments or [])
                current_attachments.append(att_item)
                obj.attachments = current_attachments
                self.message_user(
                    request,
                    f"Fichier joint '{attachment_file.name}' téléversé sur UploadThing et enregistré ({res_att['file_url']}).",
                    messages.SUCCESS,
                )
            except Exception as e:
                self.message_user(request, f"Erreur lors du téléversement du fichier joint : {e}", messages.ERROR)

        super().save_model(request, obj, form, change)


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display = ('user', 'lesson', 'is_completed', 'last_watched_second', 'completed_at', 'updated_at')
    list_filter = ('is_completed', 'completed_at')
    search_fields = ('user__username', 'user__email', 'lesson__title')


@admin.register(CourseEnrollment)
class CourseEnrollmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'course', 'progress_percent', 'enrolled_at', 'completed_at')
    list_filter = ('completed_at', 'enrolled_at')
    search_fields = ('user__username', 'user__email', 'course__title')
