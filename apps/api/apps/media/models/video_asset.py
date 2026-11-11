from django.conf import settings
from django.db import models

from common.models.base import BaseModel


class VideoStatus(models.TextChoices):
    WAITING = "waiting", "En attente d’upload"
    PREPARING = "preparing", "Traitement / Encodage"
    READY = "ready", "Prêt à la diffusion"
    ERRORED = "errored", "Erreur de transcodage"
    DELETED = "deleted", "Supprimé"


class VideoAsset(BaseModel):
    """
    Video assets managed via Mux for classroom courses, workshops, and replays.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="video_assets",
        db_index=True,
    )
    title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)

    # Mux IDs
    upload_id = models.CharField(
        max_length=255, unique=True, null=True, blank=True, db_index=True
    )
    asset_id = models.CharField(
        max_length=255, unique=True, null=True, blank=True, db_index=True
    )
    playback_id = models.CharField(
        max_length=255, unique=True, null=True, blank=True, db_index=True
    )
    passthrough = models.CharField(max_length=255, blank=True)

    # Video Metadata
    duration = models.FloatField(null=True, blank=True, help_text="Durée en secondes")
    aspect_ratio = models.CharField(max_length=20, blank=True, help_text="ex: 16:9")
    resolution = models.CharField(max_length=20, blank=True, help_text="ex: 1080p")
    max_stored_resolution = models.CharField(max_length=20, blank=True)

    # Status & Policy
    status = models.CharField(
        max_length=30,
        choices=VideoStatus.choices,
        default=VideoStatus.WAITING,
        db_index=True,
    )
    is_public = models.BooleanField(default=True, db_index=True)
    provider = models.CharField(max_length=50, default="mux")
    error_message = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "media_video_assets"
        verbose_name = "Video Asset"
        verbose_name_plural = "Video Assets"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title or self.id} ({self.status})"

    @property
    def source_url(self) -> str:
        """Direct raw file URL stored on UploadThing or local storage."""
        meta = self.metadata if isinstance(self.metadata, dict) else {}
        return meta.get("source_url") or meta.get("file_url") or ""

    @property
    def hls_url(self) -> str:
        """Adaptive streaming HLS manifest URL from Mux or direct URL fallback."""
        if self.provider in ("uploadthing", "local", "direct"):
            return self.source_url or (
                self.playback_id
                if self.playback_id and self.playback_id.startswith("http")
                else ""
            )
        if self.playback_id and not self.playback_id.startswith("http"):
            return f"https://stream.mux.com/{self.playback_id}.m3u8"
        return self.source_url or (
            self.playback_id
            if self.playback_id and self.playback_id.startswith("http")
            else ""
        )

    @property
    def thumbnail_url(self) -> str:
        """High-resolution video thumbnail image."""
        meta = self.metadata if isinstance(self.metadata, dict) else {}
        if self.playback_id and not self.playback_id.startswith("http"):
            return f"https://image.mux.com/{self.playback_id}/thumbnail.webp?width=640&height=360&fit_mode=smart"
        return meta.get("thumbnail_url") or ""

    @property
    def poster_url(self) -> str:
        """Full HD video poster frame."""
        meta = self.metadata if isinstance(self.metadata, dict) else {}
        if self.playback_id and not self.playback_id.startswith("http"):
            return f"https://image.mux.com/{self.playback_id}/thumbnail.webp?width=1920&height=1080&fit_mode=smart"
        return meta.get("poster_url") or ""

    @property
    def animated_gif_url(self) -> str:
        """Short animated preview GIF."""
        meta = self.metadata if isinstance(self.metadata, dict) else {}
        if self.playback_id and not self.playback_id.startswith("http"):
            return f"https://image.mux.com/{self.playback_id}/animated.gif?width=320&fps=15"
        return meta.get("animated_gif_url") or ""

    @property
    def normalized_status(self) -> str:
        """
        Standardized uppercase status for frontend consumption:
        PENDING_UPLOAD, UPLOADING, PROCESSING, READY, FAILED, DELETED
        """
        meta = self.metadata if isinstance(self.metadata, dict) else {}
        if self.status == VideoStatus.WAITING:
            return "UPLOADING" if meta.get("upload_started") else "PENDING_UPLOAD"
        status_map = {
            VideoStatus.PREPARING: "PROCESSING",
            VideoStatus.READY: "READY",
            VideoStatus.ERRORED: "FAILED",
            VideoStatus.DELETED: "DELETED",
        }
        return status_map.get(self.status, str(self.status).upper())

    def to_unified_dict(self, order: int = 0) -> dict:
        meta = self.metadata if isinstance(self.metadata, dict) else {}
        width = meta.get("width")
        height = meta.get("height")
        if (not width or not height) and self.aspect_ratio and ":" in self.aspect_ratio:
            try:
                w_ratio, h_ratio = (int(x) for x in self.aspect_ratio.split(":", 1))
                if w_ratio and h_ratio:
                    height = height or 1080
                    width = width or int(height * w_ratio / h_ratio)
            except Exception:
                pass
        return {
            "id": str(self.id),
            "type": "VIDEO",
            "provider": "MUX",
            "url": self.source_url or None,
            "playback_url": self.hls_url or None,
            "playback_id": self.playback_id or None,
            "thumbnail_url": self.thumbnail_url or None,
            "poster_url": self.poster_url or None,
            "filename": meta.get("file_name") or self.title or "video.mp4",
            "mime_type": meta.get("mime_type") or "video/mp4",
            "size": int(meta.get("file_size") or 0),
            "duration": self.duration,
            "width": width,
            "height": height,
            "aspect_ratio": self.aspect_ratio or None,
            "status": self.normalized_status,
            "raw_status": self.status,
            "error_message": self.error_message or None,
            "order": order,
        }
