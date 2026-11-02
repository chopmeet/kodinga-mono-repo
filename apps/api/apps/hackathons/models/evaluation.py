from common.models.base import BaseModel
from django.conf import settings
from django.db import models

from apps.hackathons.models.criterion import HackathonCriterion
from apps.hackathons.models.submission import HackathonSubmission


class HackathonEvaluation(BaseModel):
    """
    Evaluation review and score submitted by a designated jury member.
    """

    submission = models.ForeignKey(
        HackathonSubmission,
        on_delete=models.CASCADE,
        related_name="evaluations",
        db_index=True,
    )
    judge = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="hackathon_evaluations",
        db_index=True,
    )
    general_feedback = models.TextField(
        blank=True,
        help_text="Commentaires constructifs partageables avec les participants après publication",
    )
    private_notes = models.TextField(
        blank=True,
        help_text="Notes confidentielles réservées au jury et à l'organisateur",
    )
    weighted_score = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=0.0,
        help_text="Score pondéré global calculé à partir des critères",
    )
    is_submitted = models.BooleanField(default=False, db_index=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "hackathon_evaluations"
        unique_together = ("submission", "judge")
        ordering = ["-weighted_score"]
        verbose_name = "Hackathon Evaluation"
        verbose_name_plural = "Hackathon Evaluations"

    def __str__(self):
        return f"Eval by {self.judge.username} for {self.submission.title} ({self.weighted_score})"


class HackathonEvaluationScore(BaseModel):
    """
    Individual criterion score within an evaluation.
    """

    evaluation = models.ForeignKey(
        HackathonEvaluation,
        on_delete=models.CASCADE,
        related_name="scores",
        db_index=True,
    )
    criterion = models.ForeignKey(
        HackathonCriterion,
        on_delete=models.CASCADE,
        related_name="evaluation_scores",
        db_index=True,
    )
    score = models.DecimalField(max_digits=5, decimal_places=2)
    comment = models.TextField(blank=True)

    class Meta:
        db_table = "hackathon_evaluation_scores"
        unique_together = ("evaluation", "criterion")
        verbose_name = "Hackathon Evaluation Score"
        verbose_name_plural = "Hackathon Evaluation Scores"

    def __str__(self):
        return f"{self.criterion.name}: {self.score} ({self.evaluation.submission.title})"
