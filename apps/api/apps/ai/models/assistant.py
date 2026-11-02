from django.conf import settings
from django.db import models

from apps.communities.models.community import Community
from common.models.base import BaseModel


class AssistantConversation(BaseModel):
    """
    Conversational thread for an AI Community Assistant session.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assistant_conversations",
        null=True,
        blank=True,
        db_index=True,
    )
    community = models.ForeignKey(
        Community,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assistant_conversations",
        db_index=True,
    )
    title = models.CharField(max_length=255, default="Nouvelle conversation")
    context_type = models.CharField(
        max_length=50,
        default="general",
        choices=[
            ("general", "Guide & Assistance Générale"),
            ("discovery", "Découverte de communautés"),
            ("creation", "Création de communauté"),
            ("management", "Gestion et animation"),
        ],
        db_index=True,
    )

    class Meta:
        db_table = "ai_assistant_conversations"
        verbose_name = "Assistant Conversation"
        verbose_name_plural = "Assistant Conversations"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Conversation: {self.title} ({self.context_type})"


class AssistantMessage(BaseModel):
    """
    Individual message in an assistant conversation.
    """
    conversation = models.ForeignKey(
        AssistantConversation,
        on_delete=models.CASCADE,
        related_name="messages",
        db_index=True,
    )
    role = models.CharField(
        max_length=20,
        choices=[
            ("user", "Utilisateur"),
            ("assistant", "Assistant Kodinga"),
            ("system", "Système"),
        ],
    )
    content = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    provider = models.CharField(max_length=50, blank=True, default="")
    model = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        db_table = "ai_assistant_messages"
        verbose_name = "Assistant Message"
        verbose_name_plural = "Assistant Messages"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role}: {self.content[:40]}..."
