from django.conf import settings
from django.db import models

from common.models.base import BaseModel


class MediaProvider(models.TextChoices):
    UPLOADTHING = 'uploadthing', 'UploadThing'
    S3 = 's3', 'AWS S3'
    LOCAL = 'local', 'Local Storage'


class MediaPurpose(models.TextChoices):
    AVATAR = 'avatar', 'Avatar'
    BANNER = 'banner', 'Banner'
    POST_ATTACHMENT = 'post_attachment', 'Post Attachment'
    LESSON_ATTACHMENT = 'lesson_attachment', 'Lesson Attachment'
    DOCUMENT = 'document', 'Document'
    GENERAL = 'general', 'General'


class MediaStatus(models.TextChoices):
    PENDING = 'pending', 'En attente d’upload'
    READY = 'ready', 'Prêt'
    FAILED = 'failed', 'Échec'
    DELETED = 'deleted', 'Supprimé'


class MediaAsset(BaseModel):
    """
    Tracks uploaded documents, images, and static assets across the platform.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='media_assets',
        db_index=True
    )
    file_name = models.CharField(max_length=255)
    file_key = models.CharField(max_length=255, unique=True, db_index=True)
    file_url = models.URLField(max_length=1000, blank=True)
    file_size = models.BigIntegerField(default=0, help_text="Taille en octets")
    mime_type = models.CharField(max_length=100, db_index=True)
    provider = models.CharField(
        max_length=50,
        choices=MediaProvider.choices,
        default=MediaProvider.UPLOADTHING,
        db_index=True
    )
    purpose = models.CharField(
        max_length=50,
        choices=MediaPurpose.choices,
        default=MediaPurpose.GENERAL,
        db_index=True
    )
    status = models.CharField(
        max_length=30,
        choices=MediaStatus.choices,
        default=MediaStatus.PENDING,
        db_index=True
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'media_assets'
        verbose_name = 'Media Asset'
        verbose_name_plural = 'Media Assets'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.file_name} ({self.get_purpose_display()} - {self.status})"
