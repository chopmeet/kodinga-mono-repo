from django.conf import settings
from django.db import models

from common.models.base import BaseModel


class PostHelpAssistance(BaseModel):
    """
    Stores AI-suggested expert mentors and draft prompt assistance for technical
    questions that have not received an answer within the defined threshold.
    """

    post = models.OneToOneField(
        "posts.Post",
        on_delete=models.CASCADE,
        related_name="help_assistance",
    )
    suggested_experts = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="suggested_help_requests",
        blank=True,
    )
    matching_skills = models.JSONField(
        default=list,
        help_text="Technologies et concepts clés extraits de la question",
    )
    ai_comment_draft = models.TextField(
        blank=True,
        help_text="Suggestion d'amorce ou question de précision générée par l'IA",
    )
    status = models.CharField(
        max_length=30,
        default="pending",
        help_text="Statut d'assistance (pending, notified, resolved)",
    )
    notified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "ai_post_help_assistance"
        verbose_name = "Assistance d'entraide post"
        verbose_name_plural = "Assistances d'entraide posts"

    def __str__(self) -> str:
        return f"Help for Post {self.post_id} ({self.status})"

