from django.db import models

from apps.hackathons.models.hackathon import Hackathon
from common.models.base import BaseModel


class HackathonPrize(BaseModel):
    """
    Rewards and prizes offered to hackathon winners.
    """

    hackathon = models.ForeignKey(
        Hackathon,
        on_delete=models.CASCADE,
        related_name="prizes",
        db_index=True,
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    reward_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    reward_currency = models.CharField(max_length=10, default="XOF")
    reward_description = models.CharField(
        max_length=255,
        blank=True,
        help_text="Description matérielle (ex: 1 Laptop + 6 mois de mentorat)",
    )
    rank = models.PositiveIntegerField(
        default=1,
        help_text="Rang cible du prix (1 pour 1ère place, 2 pour 2ème place, etc.)",
    )
    display_order = models.PositiveIntegerField(default=0)
    winner_submission = models.ForeignKey(
        "hackathons.HackathonSubmission",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="won_prizes",
    )

    class Meta:
        db_table = "hackathon_prizes"
        ordering = ["display_order", "rank"]
        verbose_name = "Hackathon Prize"
        verbose_name_plural = "Hackathon Prizes"

    def __str__(self):
        return f"{self.title} (#{self.rank}) - {self.hackathon.title}"
