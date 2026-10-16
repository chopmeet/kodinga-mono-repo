from django.conf import settings
from django.db import models

from apps.communities.models.community import Community
from common.models.base import BaseModel


class ReputationAction(models.TextChoices):
    POST_CREATED = "post_created", "Publication créée (+5)"
    COMMENT_CREATED = "comment_created", "Commentaire posté (+2)"
    ACCEPTED_ANSWER = "accepted_answer", "Réponse validée (+15)"
    LESSON_COMPLETED = "lesson_completed", "Leçon terminée (+10)"
    COURSE_COMPLETED = "course_completed", "Formation achevée (+50)"
    EVENT_ATTENDED = "event_attended", "Participation à un événement (+20)"
    BADGE_UNLOCKED = "badge_unlocked", "Badge débloqué"
    UPVOTE_RECEIVED = "upvote_received", "Vote positif reçu (+5)"
    MANUAL_ADJUSTMENT = "manual_adjustment", "Ajustement de modération"


ACTION_DEFAULT_POINTS = {
    ReputationAction.POST_CREATED: 5,
    ReputationAction.COMMENT_CREATED: 2,
    ReputationAction.ACCEPTED_ANSWER: 15,
    ReputationAction.LESSON_COMPLETED: 10,
    ReputationAction.COURSE_COMPLETED: 50,
    ReputationAction.EVENT_ATTENDED: 20,
    ReputationAction.UPVOTE_RECEIVED: 5,
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
        pts = max(0, self.total_points)
        for threshold, lvl, title in LEVEL_THRESHOLDS:
            if pts >= threshold:
                self.level = lvl
                self.rank_title = title
                break


class ReputationTransaction(BaseModel):
    """
    Audit log of each individual reputation point gain or deduction.
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
    points = models.IntegerField()
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "gamification_reputation_transactions"
        verbose_name = "Reputation Transaction"
        verbose_name_plural = "Reputation Transactions"
        ordering = ["-created_at"]

    def __str__(self):
        sign = "+" if self.points >= 0 else ""
        return f"{self.user.username} {sign}{self.points} pts ({self.action})"
