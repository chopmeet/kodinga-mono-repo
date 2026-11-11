from django.conf import settings
from django.db import models

from common.models.base import BaseModel


class MatchType(models.TextChoices):
    PAIR_PROGRAMMING = "pair_programming", "Pair Programming"
    MENTORSHIP = "mentorship", "Mentorat"
    HACKATHON_TEAM = "hackathon_team", "Équipe Hackathon"


class MatchStatus(models.TextChoices):
    SUGGESTED = "suggested", "Suggéré"
    ACCEPTED = "accepted", "Accepté"
    DECLINED = "declined", "Refusé"


class PeerMatchRecommendation(BaseModel):
    """
    Stores AI-computed peer matching synergies between members for pair programming,
    mentorship, and hackathon team formations.
    """

    source_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="peer_matches_sent",
        db_index=True,
    )
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="peer_matches_received",
        db_index=True,
    )
    community = models.ForeignKey(
        "communities.Community",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="peer_matches",
        db_index=True,
    )
    hackathon = models.ForeignKey(
        "hackathons.Hackathon",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="peer_matches",
        db_index=True,
    )
    match_type = models.CharField(
        max_length=30,
        choices=MatchType.choices,
        default=MatchType.PAIR_PROGRAMMING,
    )
    compatibility_score = models.FloatField(
        default=0.85,
        help_text="Score de compatibilité sémantique normalisé entre 0.0 et 1.0",
    )
    match_reasons = models.JSONField(
        default=list,
        help_text="Liste des arguments justifiant la complémentarité (compétences, buts, etc.)",
    )
    status = models.CharField(
        max_length=20,
        choices=MatchStatus.choices,
        default=MatchStatus.SUGGESTED,
    )

    class Meta:
        db_table = "ai_peer_match_recommendations"
        verbose_name = "Recommandation de pair"
        verbose_name_plural = "Recommandations de pairs"
        indexes = [
            models.Index(fields=["source_user", "community"]),
            models.Index(fields=["target_user", "community"]),
        ]

    def __str__(self) -> str:
        return f"{self.source_user.username} <-> {self.target_user.username} ({self.compatibility_score:.2f})"
