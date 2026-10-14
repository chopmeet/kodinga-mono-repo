from django.conf import settings
from django.db import models

from common.models.base import BaseModel


class NotificationType(models.TextChoices):
    SYSTEM = "system", "Système"
    POST_INTERACTION = "post_interaction", "Interaction sur publication"
    COMMENT_REPLY = "comment_reply", "Réponse à un commentaire"
    ACCEPTED_ANSWER = "accepted_answer", "Réponse validée"
    MENTION = "mention", "Mention @"
    EVENT_REMINDER = "event_reminder", "Rappel d'événement"
    EVENT_LIVE_STARTED = "event_live_started", "Événement en direct"
    COURSE_NEW = "course_new", "Nouveau cours disponible"
    BADGE_UNLOCKED = "badge_unlocked", "Badge débloqué"
    COMMUNITY_INVITE = "community_invite", "Invitation à une communauté"


class Notification(BaseModel):
    """
    In-app developer notifications model with read tracking and direct
    UI navigation actions.
    """

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="acted_notifications",
    )
    notification_type = models.CharField(
        max_length=50,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM,
        db_index=True,
    )
    title = models.CharField(max_length=255)
    body = models.TextField()
    action_url = models.CharField(
        max_length=500,
        blank=True,
        help_text="Lien de navigation web cible",
    )
    target_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="Type d'entité cible (ex: post, event, course, badge)",
    )
    target_id = models.CharField(
        max_length=255,
        blank=True,
        help_text="Identifiant de l'entité cible",
    )
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "notifications"
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        ordering = ["-created_at"]

    def __str__(self):
        status_str = "Lue" if self.is_read else "Non lue"
        return f"[{status_str}] {self.recipient.username} <- {self.title}"
