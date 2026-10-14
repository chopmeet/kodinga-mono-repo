from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.communities.models.community import Community
from apps.media.models.video_asset import VideoAsset
from common.models.base import BaseModel


class EventType(models.TextChoices):
    LIVE_STREAM = "live_stream", "Live Streaming / Salon LiveKit"
    WEBINAR = "webinar", "Webinaire / Conférence"
    WORKSHOP = "workshop", "Atelier pratique / Coding Session"
    QNA = "qna", "Session Q&A / Foire aux questions"
    MEETUP = "meetup", "Rencontre communautaire"


class EventFormat(models.TextChoices):
    LIVEKIT = "livekit", "Salon LiveKit interactif intégré"
    EXTERNAL = "external", "Lien externe (Google Meet, Zoom, YouTube)"
    IN_PERSON = "in_person", "Présentiel"


class EventStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Programmé"
    LIVE = "live", "En direct / En cours"
    COMPLETED = "completed", "Terminé"
    CANCELLED = "cancelled", "Annulé"


class Event(BaseModel):
    """
    Community event model representing workshops, webinars, meetups
    and interactive LiveKit live rooms.
    """

    community = models.ForeignKey(
        Community, on_delete=models.CASCADE, related_name="events", db_index=True
    )
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="hosted_events",
        db_index=True,
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, db_index=True)
    description = models.TextField(blank=True)
    cover_image_url = models.URLField(max_length=1000, blank=True)

    event_type = models.CharField(
        max_length=30,
        choices=EventType.choices,
        default=EventType.LIVE_STREAM,
        db_index=True,
    )
    format = models.CharField(
        max_length=20,
        choices=EventFormat.choices,
        default=EventFormat.LIVEKIT,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=EventStatus.choices,
        default=EventStatus.SCHEDULED,
        db_index=True,
    )

    start_time = models.DateTimeField(db_index=True)
    end_time = models.DateTimeField(db_index=True)
    timezone = models.CharField(max_length=50, default="UTC")

    location_url = models.URLField(
        max_length=1000,
        blank=True,
        help_text="Lien externe si format=external (ex: Google Meet, Zoom)",
    )
    live_room_name = models.CharField(
        max_length=255,
        blank=True,
        db_index=True,
        help_text="Identifiant unique de la salle LiveKit pour streaming interactif",
    )

    max_attendees = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Jauge maximale de participants (null = illimité)",
    )
    attendees_count = models.PositiveIntegerField(default=0)

    is_recorded = models.BooleanField(
        default=True,
        help_text="Indique si un enregistrement / replay vidéo sera disponible",
    )
    replay_video_asset = models.ForeignKey(
        VideoAsset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorded_events",
    )
    is_public = models.BooleanField(
        default=True,
        help_text="Visible publiquement ou restreint aux membres de la communauté",
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "events_events"
        verbose_name = "Event"
        verbose_name_plural = "Events"
        unique_together = ("community", "slug")
        ordering = ["start_time"]

    def __str__(self):
        return f"[{self.community.name}] {self.title} ({self.get_status_display()})"

    @property
    def is_upcoming(self) -> bool:
        return self.status == EventStatus.SCHEDULED and self.start_time > timezone.now()

    @property
    def is_in_progress(self) -> bool:
        now = timezone.now()
        return self.status == EventStatus.LIVE or (
            self.start_time <= now <= self.end_time
            and self.status != EventStatus.COMPLETED
        )

    @property
    def is_full(self) -> bool:
        if self.max_attendees is not None:
            return self.attendees_count >= self.max_attendees
        return False

    @property
    def duration_minutes(self) -> int:
        if self.end_time and self.start_time:
            diff = (self.end_time - self.start_time).total_seconds()
            return max(1, int(diff // 60))
        return 60
