from django.conf import settings
from django.db import models

from apps.communities.models.community import Community
from common.models.base import BaseModel


class ReputationAction(models.TextChoices):
    COURSE_COMPLETED = "course_completed", "Formation terminée (+50)"
    EVENT_ATTENDED = "event_attended", "Participation à un événement (+30)"
    POST_CREATED = "post_created", "Publication d'un post (feed) (+10)"
    COMMENT_CREATED = "comment_created", "Commentaire posté (+2)"
    ACCEPTED_ANSWER = "accepted_answer", "Réponse validée (+15)"
    LESSON_COMPLETED = "lesson_completed", "Leçon terminée (+10)"
    UPVOTE_RECEIVED = "upvote_received", "Vote positif reçu (+5)"
    HACKATHON_SUBMITTED = "hackathon_submitted", "Projet de hackathon soumis (+40)"
    BADGE_UNLOCKED = "badge_unlocked", "Badge débloqué"
    MANUAL_ADJUSTMENT = "manual_adjustment", "Ajustement manuel"


class TransactionSource(models.TextChoices):
    AUTOMATIC = "automatic", "Attribution automatique"
    MANUAL_ADJUSTMENT = "manual_adjustment", "Ajustement manuel"
    BADGE_REWARD = "badge_reward", "Récompense de badge"
    SYSTEM = "system", "Système"


# Default points per rewardable activity (configurable per community)
ACTION_DEFAULT_POINTS: dict[str, int] = {
    ReputationAction.COURSE_COMPLETED: 50,
    ReputationAction.EVENT_ATTENDED: 30,
    ReputationAction.POST_CREATED: 10,
    ReputationAction.ACCEPTED_ANSWER: 15,
    ReputationAction.LESSON_COMPLETED: 10,
    ReputationAction.UPVOTE_RECEIVED: 5,
    ReputationAction.COMMENT_CREATED: 2,
    ReputationAction.HACKATHON_SUBMITTED: 40,
}

# Metadata catalog of configurable rewardable activities per community
REWARDABLE_ACTIVITIES_CATALOG: list[dict[str, object]] = [
    {
        "action": ReputationAction.COURSE_COMPLETED,
        "label": "Formation terminée",
        "description": "Attribué lorsqu'un membre termine effectivement toutes les leçons d'une formation.",
        "default_points": 50,
        "default_is_active": True,
        "allow_multiple_per_reference": False,
    },
    {
        "action": ReputationAction.EVENT_ATTENDED,
        "label": "Participation à un événement",
        "description": "Attribué lorsque la participation effective (check-in / présence) du membre à un événement est confirmée.",
        "default_points": 30,
        "default_is_active": True,
        "allow_multiple_per_reference": False,
    },
    {
        "action": ReputationAction.POST_CREATED,
        "label": "Publication d'un post (feed)",
        "description": "Attribué lorsqu'un membre publie un post valide dans le fil d'actualité de la communauté.",
        "default_points": 10,
        "default_is_active": True,
        "allow_multiple_per_reference": False,
    },
    {
        "action": ReputationAction.ACCEPTED_ANSWER,
        "label": "Réponse validée",
        "description": "Attribué lorsque le commentaire d'un membre est marqué comme réponse acceptée.",
        "default_points": 15,
        "default_is_active": True,
        "allow_multiple_per_reference": False,
    },
    {
        "action": ReputationAction.COMMENT_CREATED,
        "label": "Commentaire publié",
        "description": "Attribué lorsqu'un membre publie un commentaire constructif sur un post.",
        "default_points": 2,
        "default_is_active": False,
        "allow_multiple_per_reference": False,
    },
    {
        "action": ReputationAction.LESSON_COMPLETED,
        "label": "Leçon terminée",
        "description": "Attribué lorsqu'un membre valide une leçon individuelle.",
        "default_points": 10,
        "default_is_active": False,
        "allow_multiple_per_reference": False,
    },
    {
        "action": ReputationAction.UPVOTE_RECEIVED,
        "label": "Vote positif reçu",
        "description": "Attribué lorsqu'un membre reçoit un vote positif sur sa contribution ou son projet.",
        "default_points": 5,
        "default_is_active": True,
        "allow_multiple_per_reference": False,
    },
    {
        "action": ReputationAction.HACKATHON_SUBMITTED,
        "label": "Projet de hackathon soumis",
        "description": "Attribué lorsqu'un membre soumet son projet final lors d'un hackathon.",
        "default_points": 40,
        "default_is_active": True,
        "allow_multiple_per_reference": False,
    },
]

CATALOG_BY_ACTION: dict[str, dict[str, object]] = {
    str(item["action"]): item for item in REWARDABLE_ACTIVITIES_CATALOG
}

LEVEL_THRESHOLDS = [
    (6000, 8, "Légende Kodinga"),
    (3000, 7, "Architecte"),
    (1500, 6, "Mentor"),
    (750, 5, "Expert"),
    (350, 4, "Artisan du code"),
    (150, 3, "Praticien"),
    (50, 2, "Développeur"),
    (0, 1, "Initié"),
]


def compute_level_and_rank(points: int) -> tuple[int, str]:
    """
    Computes the numeric level and rank title for a given point total.
    """
    pts = max(0, int(points or 0))
    for threshold, lvl, title in LEVEL_THRESHOLDS:
        if pts >= threshold:
            return lvl, title
    return 1, "Initié"


class UserReputation(BaseModel):
    """
    Aggregated developer reputation score, level and status tracking.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reputation",
        db_index=True,
    )
    total_points = models.IntegerField(default=0, db_index=True)
    level = models.PositiveIntegerField(default=1, db_index=True)
    rank_title = models.CharField(max_length=100, default="Initié")
    current_streak_days = models.PositiveIntegerField(default=0)
    last_activity_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "gamification_user_reputations"
        verbose_name = "User Reputation"
        verbose_name_plural = "User Reputations"
        ordering = ["-total_points"]

    def __str__(self):
        return f"{self.user.username} - {self.total_points} pts (Niveau {self.level})"

    def update_level_and_rank(self) -> None:
        """
        Recalculates level and rank title based on total points threshold.
        """
        self.level, self.rank_title = compute_level_and_rank(self.total_points)


class CommunityPointRule(BaseModel):
    """
    Per-community configurable point rule for a rewardable activity.
    Modifications only apply to future point attributions and never
    recalculate past transactions retroactively.
    """

    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name="point_rules",
        db_index=True,
    )
    action = models.CharField(
        max_length=50,
        choices=ReputationAction.choices,
        db_index=True,
    )
    label = models.CharField(max_length=150, blank=True)
    description = models.CharField(max_length=255, blank=True)
    points = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)
    allow_multiple_per_reference = models.BooleanField(
        default=False,
        help_text="Si activé, autorise plusieurs attributions pour la même référence d'activité.",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_community_point_rules",
    )

    class Meta:
        db_table = "gamification_community_point_rules"
        verbose_name = "Community Point Rule"
        verbose_name_plural = "Community Point Rules"
        unique_together = ("community", "action")
        ordering = ["action"]
        indexes = [
            models.Index(
                fields=["community", "action", "is_active"],
                name="idx_comm_pt_rule_lookup",
            ),
        ]

    def __str__(self):
        status_str = "Actif" if self.is_active else "Inactif"
        return f"{self.community.slug} - {self.action}: {self.points} pts ({status_str})"


class CommunityPointRuleAuditLog(BaseModel):
    """
    Immutable audit log of modifications made to a community's point scale (barème).
    """

    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name="point_rule_audit_logs",
        db_index=True,
    )
    rule = models.ForeignKey(
        CommunityPointRule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(
        max_length=50,
        choices=ReputationAction.choices,
        db_index=True,
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="point_rule_audit_logs",
    )
    previous_points = models.IntegerField(null=True, blank=True)
    new_points = models.IntegerField()
    previous_is_active = models.BooleanField(null=True, blank=True)
    new_is_active = models.BooleanField()
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "gamification_point_rule_audit_logs"
        verbose_name = "Community Point Rule Audit Log"
        verbose_name_plural = "Community Point Rule Audit Logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["community", "-created_at"],
                name="idx_pt_rule_audit_comm_date",
            ),
        ]

    def __str__(self):
        return (
            f"{self.community.slug} [{self.action}]: "
            f"{self.previous_points}->{self.new_points} pts"
        )


class ReputationTransaction(BaseModel):
    """
    Immutable audit log of each individual reputation point gain or manual adjustment.
    Stores member ID, community ID, activity type, activity reference, points,
    timestamp, attribution source, and idempotency key.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reputation_transactions",
        db_index=True,
    )
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="reputation_transactions",
        db_index=True,
    )
    action = models.CharField(
        max_length=50,
        choices=ReputationAction.choices,
        default=ReputationAction.MANUAL_ADJUSTMENT,
        db_index=True,
    )
    reference_type = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Type de l'entité source (course, event, post, comment, badge, manual)",
    )
    reference_id = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        help_text="Identifiant de l'activité ou entité ayant généré les points",
    )
    points = models.IntegerField()
    source = models.CharField(
        max_length=30,
        choices=TransactionSource.choices,
        default=TransactionSource.AUTOMATIC,
        db_index=True,
    )
    awarded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="awarded_reputation_transactions",
        help_text="Propriétaire ou administrateur ayant effectué un ajustement manuel",
    )
    idempotency_key = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        unique=True,
        db_index=True,
        help_text="Clé d'idempotence garantissant l'absence de double attribution",
    )
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "gamification_reputation_transactions"
        verbose_name = "Reputation Transaction"
        verbose_name_plural = "Reputation Transactions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["community", "user", "-created_at"],
                name="idx_rep_tx_comm_user_date",
            ),
            models.Index(
                fields=["community", "action", "reference_id"],
                name="idx_rep_tx_comm_act_ref",
            ),
            models.Index(
                fields=["community", "-created_at"],
                name="idx_rep_tx_comm_date",
            ),
        ]

    def __str__(self):
        sign = "+" if self.points >= 0 else ""
        return f"{self.user.username} {sign}{self.points} pts ({self.action})"
