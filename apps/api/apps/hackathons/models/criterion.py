from common.models.base import BaseModel
from django.db import models

from apps.hackathons.models.hackathon import Hackathon


class HackathonCriterion(BaseModel):
    """
    Judging criteria for project evaluation (e.g., Innovation, Technical execution).
    """

    hackathon = models.ForeignKey(
        Hackathon,
        on_delete=models.CASCADE,
        related_name="criteria",
        db_index=True,
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    min_score = models.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    max_score = models.DecimalField(max_digits=5, decimal_places=2, default=20.0)
    weight = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=1.0,
        help_text="Coefficient ou poids relatif dans la note finale",
    )
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "hackathon_criteria"
        ordering = ["display_order", "created_at"]
        verbose_name = "Hackathon Criterion"
        verbose_name_plural = "Hackathon Criteria"

    def __str__(self):
        return f"{self.name} (weight: {self.weight}) - {self.hackathon.title}"
