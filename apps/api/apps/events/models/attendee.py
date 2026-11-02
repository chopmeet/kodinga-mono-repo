from common.models.base import BaseModel
from django.conf import settings
from django.db import models

from apps.events.models.event import Event


class AttendeeStatus(models.TextChoices):
    ATTENDING = "attending", "Inscrit / Participe"
    MAYBE = "maybe", "Intéressé / Peut-être"
    DECLINED = "declined", "Ne participe pas"


class EventAttendee(BaseModel):
    """
    Tracks member RSVP, registration and attendance check-in for an event.
    """

    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="attendees", db_index=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="event_registrations",
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=AttendeeStatus.choices,
        default=AttendeeStatus.ATTENDING,
        db_index=True,
    )
    checked_in_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Horodatage quand l'utilisateur a rejoint la salle live",
    )
    reminder_sent = models.BooleanField(
        default=False, help_text="Indique si le rappel d'agenda a été envoyé par email"
    )

    class Meta:
        db_table = "events_attendees"
        verbose_name = "Event Attendee"
        verbose_name_plural = "Event Attendees"
        unique_together = ("event", "user")
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"{self.user.username} -> {self.event.title} ({self.get_status_display()})"
        )
