from django.conf import settings
from django.db import models

from apps.hackathons.models.hackathon import Hackathon
from common.models.base import BaseModel


class HackathonJudge(BaseModel):
    """
    Designates an evaluator/jury member for a hackathon.
    """

    hackathon = models.ForeignKey(
        Hackathon,
        on_delete=models.CASCADE,
        related_name="judge_assignments",
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="judge_roles",
        db_index=True,
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_judges",
    )
    can_evaluate_all = models.BooleanField(
        default=True,
        help_text="Peut évaluer l'ensemble des projets soumis au hackathon",
    )

    class Meta:
        db_table = "hackathon_judges"
        unique_together = ("hackathon", "user")
        verbose_name = "Hackathon Judge"
        verbose_name_plural = "Hackathon Judges"

    def __str__(self):
        return f"Judge: {self.user.username} for {self.hackathon.title}"
