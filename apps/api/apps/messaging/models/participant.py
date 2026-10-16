from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.messaging.models.conversation import Conversation
from common.models.base import BaseModel


class ParticipantRole(models.TextChoices):
    MEMBER = "member", "Membre"
    ADMIN = "admin", "Administrateur"


class ConversationParticipant(BaseModel):
    """
    Participant in a conversation with tracking of last read timestamp.
    """

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="participants",
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversation_participations",
        db_index=True,
    )
    role = models.CharField(
        max_length=20,
        choices=ParticipantRole.choices,
        default=ParticipantRole.MEMBER,
    )
    joined_at = models.DateTimeField(default=timezone.now)
    last_read_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "messaging_participants"
        unique_together = ("conversation", "user")
        ordering = ["joined_at"]

    def __str__(self):
        return f"{self.user.username} in {self.conversation_id}"
