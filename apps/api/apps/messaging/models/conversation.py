from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.communities.models.community import Community
from common.models.base import BaseModel


class ConversationType(models.TextChoices):
    DIRECT = "direct", "Direct (1-to-1)"
    GROUP = "group", "Groupe"


class Conversation(BaseModel):
    """
    Direct messaging or group conversation model.
    """

    conversation_type = models.CharField(
        max_length=20,
        choices=ConversationType.choices,
        default=ConversationType.DIRECT,
        db_index=True,
    )
    title = models.CharField(max_length=255, blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_conversations",
    )
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="conversations",
    )
    last_message_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "messaging_conversations"
        ordering = ["-last_message_at"]

    def __str__(self):
        if self.conversation_type == ConversationType.DIRECT:
            return f"Direct Conversation ({self.id})"
        return self.title or f"Group Conversation ({self.id})"
