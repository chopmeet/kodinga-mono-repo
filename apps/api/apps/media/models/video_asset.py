from django.conf import settings
from django.db import models
from common.models.base import BaseModel


class VideoStatus(models.TextChoices):
    WAITING = 'waiting', 'En attente d’upload'
    PREPARING = 'preparing', 'Traitement / Encodage'
    READY = 'ready', 'Prêt à la diffusion'
    ERRORED = 'errored', 'Erreur de transcodage'
    DELETED = 'deleted', 'Supprimé'


class VideoAsset(BaseModel):
    """
    Video assets managed via Mux for classroom courses, workshops, and replays.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='video_assets',
        db_index=True
    )
    title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    
    # Mux IDs
    upload_id = models.CharField(max_length=255, unique=True, null=True, blank=True, db_index=True)
    asset_id = models.CharField(max_length=255, unique=True, null=True, blank=True, db_index=True)
    playback_id = models.CharField(max_length=255, unique=True, null=True, blank=True, db_index=True)
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
        db_index=True
    )
    is_public = models.BooleanField(default=True, db_index=True)
    provider = models.CharField(max_length=50, default='mux')
    error_message = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'media_video_assets'
        verbose_name = 'Video Asset'
        verbose_name_plural = 'Video Assets'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title or self.id} ({self.status})"

    @property
    def hls_url(self) -> str:
        """Adaptive streaming HLS manifest URL from Mux."""
        if self.playback_id and self.status == VideoStatus.READY:
            return f"https://stream.mux.com/{self.playback_id}.m3u8"
        return ""

    @property
    def thumbnail_url(self) -> str:
        """High-resolution video thumbnail image."""
        if self.playback_id and self.status == VideoStatus.READY:
            return f"https://image.mux.com/{self.playback_id}/thumbnail.webp?width=640&height=360&fit_mode=smart"
        return ""

    @property
    def poster_url(self) -> str:
        """Full HD video poster frame."""
        if self.playback_id and self.status == VideoStatus.READY:
            return f"https://image.mux.com/{self.playback_id}/thumbnail.webp?width=1920&height=1080&fit_mode=smart"
        return ""

    @property
    def animated_gif_url(self) -> str:
        """Short animated preview GIF."""
        if self.playback_id and self.status == VideoStatus.READY:
            return f"https://image.mux.com/{self.playback_id}/animated.gif?width=320&fps=15"
        return ""
