from common.models.base import BaseModel
from django.conf import settings
from django.db import models

from apps.communities.models.community import Community


class ModerationDecision(models.TextChoices):
    ALLOW = "allow", "Autorisé"
    REJECT = "reject", "Rejeté (Bloqué)"
    REVIEW = "review", "En attente de vérification"


class ModerationAuditLog(BaseModel):
    """
    Audit and compliance log recording all content moderation decisions,
    violated categories, provider used, and administrative review status.
    """

    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="ai_moderation_logs",
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_moderation_logs",
        db_index=True,
    )
    content_preview = models.CharField(
        max_length=255,
        help_text="Extrait tronqué du message pour préserver la confidentialité",
    )
    content_hash = models.CharField(max_length=64, db_index=True)
    decision = models.CharField(
        max_length=20,
        choices=ModerationDecision.choices,
        default=ModerationDecision.ALLOW,
        db_index=True,
    )
    categories = models.JSONField(
        default=list,
        blank=True,
        help_text="Catégories de sécurité enfreintes (ex: sexual_harassment, targeted_harassment)",
    )
    confidence = models.FloatField(default=1.0)
    reason = models.TextField(blank=True)
    provider = models.CharField(max_length=30, default="gemini", db_index=True)
    model = models.CharField(max_length=100, blank=True)

    # Human-in-the-loop review
    is_reviewed_by_admin = models.BooleanField(default=False, db_index=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ai_reviewed_logs",
    )
    admin_notes = models.TextField(blank=True)

    class Meta:
        db_table = "ai_moderation_audit_logs"
        ordering = ["-created_at"]
        verbose_name = "Moderation Audit Log"
        verbose_name_plural = "Moderation Audit Logs"

    def __str__(self):
        return f"[{self.provider.upper()}] {self.decision} ({self.created_at})"
