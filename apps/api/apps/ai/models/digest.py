from django.conf import settings
from django.db import models

from common.models.base import BaseModel


class CommunityWeeklyDigest(BaseModel):
    """
    Weekly automated summary (Community Pulse) aggregating highlights,
    top technical discussions, outstanding projects, and upcoming events.
    """

    community = models.ForeignKey(
        "communities.Community",
        on_delete=models.CASCADE,
        related_name="weekly_digests",
        db_index=True,
    )
    week_identifier = models.CharField(
        max_length=20,
        db_index=True,
        help_text="Identifiant de la semaine (ex: '2026-W45')",
    )
    headline = models.CharField(
        max_length=255,
        help_text="Titre d'accroche généré par l'IA",
    )
    summary_markdown = models.TextField(
        help_text="Contenu structuré en Markdown prêt pour l'affichage in-app et email",
    )
    top_debates = models.JSONField(
        default=list,
        help_text="Liste des discussions les plus actives et leurs points clés",
    )
    highlighted_project = models.JSONField(
        default=dict,
        blank=True,
        help_text="Projet membre mis à l'honneur cette semaine",
    )
    upcoming_events = models.JSONField(
        default=list,
        blank=True,
        help_text="Événements et ateliers prévus pour la semaine à venir",
    )
    kpis_snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text="Statistiques clés (nouveaux membres, posts, complétions de cours)",
    )

    class Meta:
        db_table = "ai_community_weekly_digests"
        verbose_name = "Digest hebdomadaire IA"
        verbose_name_plural = "Digests hebdomadaires IA"
        unique_together = ("community", "week_identifier")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Digest {self.community.slug} ({self.week_identifier})"


class UserDigestDelivery(BaseModel):
    """Tracks per-user digest delivery and read timestamps."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="digest_deliveries",
    )
    digest = models.ForeignKey(
        CommunityWeeklyDigest,
        on_delete=models.CASCADE,
        related_name="user_deliveries",
    )
    delivered_via_email = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "ai_user_digest_deliveries"
        unique_together = ("user", "digest")

