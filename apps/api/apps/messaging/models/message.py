from apps.messaging.models.conversation import Conversation
from common.models.base import BaseModel
from django.conf import settings
from django.db import models


class Message(BaseModel):
    """
    Message model within a conversation.
    """

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
        db_index=True,
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_messages",
        db_index=True,
    )
    content = models.TextField()
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "messaging_messages"
        ordering = ["created_at"]

    def __str__(self):
        return f"Message by {self.sender.username} in {self.conversation_id} at {self.created_at}"
