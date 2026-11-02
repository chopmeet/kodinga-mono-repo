from django.db import models

from apps.messaging.models.message import Message
from common.models.base import BaseModel


class MessageAttachment(BaseModel):
    """
    Attachment attached to a message.
    """

    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="attachments",
        db_index=True,
    )
    file_url = models.URLField(max_length=1000)
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(default=0)
    content_type = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = "messaging_attachments"

    def __str__(self):
        return f"{self.file_name} ({self.file_size} bytes)"
