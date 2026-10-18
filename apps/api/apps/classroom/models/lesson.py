from django.db import models

from apps.classroom.models.module import CourseModule
from apps.media.models.video_asset import VideoAsset
from common.models.base import BaseModel


class LessonType(models.TextChoices):
    TEXT = 'text', 'Texte & Images / Tutoriel'
    VIDEO = 'video', 'Vidéo'
    HYBRID = 'hybrid', 'Mixte (Vidéo, Texte & Schémas)'
    ARTICLE = 'article', 'Article / Guide'
    CODE_EXERCISE = 'code', 'Exercice de code'
    QUIZ = 'quiz', 'Quiz / QCM'


class ContentFormat(models.TextChoices):
    MARKDOWN = 'markdown', 'Markdown'
    HTML = 'html', 'HTML Enrichi'
    JSON = 'json', 'Rich Text JSON (TipTap/ProseMirror)'


class Lesson(BaseModel):
    """
    Individual lesson unit inside a CourseModule.
    Supports rich text (Markdown / HTML / JSON), images & diagrams, video streams (Mux), and attachments.
    """
    module = models.ForeignKey(
        CourseModule,
        on_delete=models.CASCADE,
        related_name='lessons',
        db_index=True
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, db_index=True)
    content = models.TextField(
        blank=True,
        help_text="Contenu texte riche formaté (Markdown, HTML ou JSON structuré)"
    )
    content_format = models.CharField(
        max_length=20,
        choices=ContentFormat.choices,
        default=ContentFormat.MARKDOWN,
        db_index=True
    )
    cover_image_url = models.URLField(
        max_length=1000,
        blank=True,
        help_text="Image d'en-tête ou bannière illustrative de la leçon"
    )
    images = models.JSONField(
        default=list,
        blank=True,
        help_text="Images et schémas rattachés à la leçon [ {url, caption, alt, media_asset_id} ]"
    )
    lesson_type = models.CharField(
        max_length=30,
        choices=LessonType.choices,
        default=LessonType.TEXT,
        db_index=True
    )
    video_asset = models.ForeignKey(
        VideoAsset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='classroom_lessons',
        db_index=True
    )
    duration_seconds = models.PositiveIntegerField(
        default=0,
        help_text="Durée de la vidéo ou temps de lecture estimé en secondes"
    )
    order = models.PositiveIntegerField(default=0, db_index=True)
    is_free_preview = models.BooleanField(
        default=False,
        help_text="Accessible librement en avant-première sans restriction séquentielle"
    )
    attachments = models.JSONField(
        default=list,
        blank=True,
        help_text="Fichiers téléchargeables, PDF, code source zippé"
    )

    class Meta:
        db_table = 'classroom_lessons'
        verbose_name = 'Lesson'
        verbose_name_plural = 'Lessons'
        unique_together = ('module', 'slug')
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.module.title} - {self.title} ({self.get_lesson_type_display()})"

    @property
    def video_hls_url(self) -> str:
        return self.video_asset.hls_url if self.video_asset else ""

    @property
    def video_thumbnail_url(self) -> str:
        return self.video_asset.thumbnail_url if self.video_asset else ""

    @property
    def video_playback_id(self) -> str:
        return self.video_asset.playback_id if self.video_asset else ""

    @property
    def video_status(self) -> str:
        return self.video_asset.status if self.video_asset else ""

    @property
    def video_source_url(self) -> str:
        """
        Original raw video file URL hosted on UploadThing CDN.
        """
        if self.video_asset and isinstance(self.video_asset.metadata, dict):
            return self.video_asset.metadata.get('source_url', '')
        return ""

    @property
    def reading_time_minutes(self) -> int:
        """
        Estimated reading time based on 200 words per minute average reading speed.
        """
        if not self.content:
            return 1
        word_count = len(self.content.split())
        return max(1, round(word_count / 200))

    @property
    def estimated_duration_display(self) -> str:
        """
        Human-readable duration display (e.g., '14:20' for videos or '6 min de lecture' for articles).
        """
        if self.video_asset and self.duration_seconds:
            mins = self.duration_seconds // 60
            secs = self.duration_seconds % 60
            return f"{mins}:{secs:02d}"
        if self.content:
            return f"{self.reading_time_minutes} min de lecture"
        return "1 min"

    @property
    def has_video(self) -> bool:
        return bool(self.video_asset_id)

    @property
    def has_images(self) -> bool:
        return bool(self.cover_image_url or self.images)
