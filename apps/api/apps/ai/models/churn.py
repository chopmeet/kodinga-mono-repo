from django.db import models

from common.models.base import BaseModel


class ChurnRiskLevel(models.TextChoices):
    LOW = "low", "Faible"
    MEDIUM = "medium", "Moyen"
    HIGH = "high", "Élevé"
    CRITICAL = "critical", "Critique"


class MemberChurnRisk(BaseModel):
    """
    Predictive churn risk profile and personalized smart nudge recommendations
    for creators to retain at-risk members before they leave or unsubscribe.
    """

    member = models.OneToOneField(
        "memberships.CommunityMember",
        on_delete=models.CASCADE,
        related_name="churn_risk",
    )
    risk_level = models.CharField(
        max_length=20,
        choices=ChurnRiskLevel.choices,
        default=ChurnRiskLevel.LOW,
        db_index=True,
    )
    risk_score = models.FloatField(
        default=0.0,
        help_text="Score de risque de désengagement calculé entre 0.0 et 100.0",
    )
    signals = models.JSONField(
        default=dict,
        blank=True,
        help_text="Signaux comportementaux détectés (ex: jours inactifs, blocage de leçon)",
    )
    suggested_nudge = models.TextField(
        blank=True,
        help_text="Message personnalisé bienveillant pré-rédigé par l'IA",
    )
    nudge_sent_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=30,
        default="open",
        help_text="Statut d'intervention (open, nudge_sent, retained, churned)",
    )
    last_evaluated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ai_member_churn_risks"
        verbose_name = "Risque d'attrition membre"
        verbose_name_plural = "Risques d'attrition membres"
        ordering = ["-risk_score"]

    def __str__(self) -> str:
        return f"{self.member.user.username} - Risque {self.risk_level} ({self.risk_score:.1f})"

