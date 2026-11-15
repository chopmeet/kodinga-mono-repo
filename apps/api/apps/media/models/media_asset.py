import os

from django.conf import settings
from django.db import models

from common.models.base import BaseModel


class MediaProvider(models.TextChoices):
    UPLOADTHING = "uploadthing", "UploadThing"
    S3 = "s3", "AWS S3"
    LOCAL = "local", "Local Storage"


class MediaPurpose(models.TextChoices):
    AVATAR = "avatar", "Avatar"
    BANNER = "banner", "Banner"
    EVENT_BANNER = "event_banner", "Event Banner"
    HACKATHON_BANNER = "hackathon_banner", "Hackathon Banner"
    COURSE_BANNER = "course_banner", "Course Banner"
    CLASSROOM_COVER = "classroom_cover", "Classroom Cover"
    COMMUNITY_BANNER = "community_banner", "Community Banner"
    POST_ATTACHMENT = "post_attachment", "Post Attachment"
    POST_IMAGE = "post_image", "Post Image"
    POST_DOCUMENT = "post_document", "Post Document"
    POST_VIDEO = "post_video", "Post Video"
    LESSON_ATTACHMENT = "lesson_attachment", "Lesson Attachment"
    LESSON_VIDEO = "lesson_video", "Lesson Video"
    DOCUMENT = "document", "Document"
    GENERAL = "general", "General"


class MediaStatus(models.TextChoices):
    PENDING = "pending", "En attente d’upload"
    READY = "ready", "Prêt"
    FAILED = "failed", "Échec"
    DELETED = "deleted", "Supprimé"


class MediaAsset(BaseModel):
    """
    Tracks uploaded documents, images, and static assets across the platform.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="media_assets",
        db_index=True,
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
        db_index=True,
    )
    purpose = models.CharField(
        max_length=50,
        choices=MediaPurpose.choices,
        default=MediaPurpose.GENERAL,
        db_index=True,
    )
    status = models.CharField(
        max_length=30,
        choices=MediaStatus.choices,
        default=MediaStatus.PENDING,
        db_index=True,
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "media_assets"
        verbose_name = "Media Asset"
        verbose_name_plural = "Media Assets"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.file_name} ({self.get_purpose_display()} - {self.status})"

    @property
    def media_category(self) -> str:
        """
        Returns the normalized media type: 'IMAGE', 'VIDEO', or 'DOCUMENT'.
        """
        if self.purpose == MediaPurpose.POST_IMAGE:
            return "IMAGE"
        if self.purpose == MediaPurpose.POST_DOCUMENT:
            return "DOCUMENT"
        if self.purpose in (MediaPurpose.POST_VIDEO, MediaPurpose.LESSON_VIDEO):
            return "VIDEO"

        mime = (self.mime_type or "").lower()
        ext = os.path.splitext(self.file_name or "")[1].lower()
        if mime.startswith("image/") or ext in {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".gif",
        }:
            return "IMAGE"
        if mime.startswith("video/") or ext in {".mp4", ".mov", ".webm"}:
            return "VIDEO"
        return "DOCUMENT"

    @property
    def normalized_status(self) -> str:
        status_map = {
            MediaStatus.PENDING: "PENDING_UPLOAD",
            MediaStatus.READY: "READY",
            MediaStatus.FAILED: "FAILED",
            MediaStatus.DELETED: "DELETED",
        }
        return status_map.get(self.status, str(self.status).upper())

    def to_unified_dict(self, order: int = 0) -> dict:
        meta = self.metadata if isinstance(self.metadata, dict) else {}
        return {
            "id": str(self.id),
            "type": self.media_category,
            "provider": "UPLOADTHING"
            if self.provider == MediaProvider.UPLOADTHING
            else str(self.provider).upper(),
            "url": self.file_url or None,
            "playback_url": self.file_url if self.media_category == "VIDEO" else None,
            "playback_id": None,
            "thumbnail_url": self.file_url
            if self.media_category == "IMAGE"
            else meta.get("thumbnail_url"),
            "poster_url": meta.get("poster_url"),
            "filename": self.file_name,
            "mime_type": self.mime_type,
            "size": self.file_size,
            "duration": meta.get("duration"),
            "width": meta.get("width"),
            "height": meta.get("height"),
            "status": self.normalized_status,
            "order": order,
        }
