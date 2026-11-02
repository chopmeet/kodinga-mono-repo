from common.models.base import BaseModel
from django.conf import settings
from django.db import models

from apps.hackathons.models.hackathon import Hackathon


class ParticipationMode(models.TextChoices):
    INDIVIDUAL = "individual", "Individuel"
    TEAM = "team", "En équipe"


class ApplicationStatus(models.TextChoices):
    PENDING = "pending", "En attente d'examen"
    ACCEPTED = "accepted", "Acceptée"
    REJECTED = "rejected", "Refusée"
    WAITLISTED = "waitlisted", "Sur liste d'attente"
    WITHDRAWN = "withdrawn", "Retirée"


class HackathonApplication(BaseModel):
    """
    Candidate application to participate in a hackathon.
    """

    hackathon = models.ForeignKey(
        Hackathon,
        on_delete=models.CASCADE,
        related_name="applications",
        db_index=True,
    )
    applicant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="hackathon_applications",
        db_index=True,
    )
    participation_mode = models.CharField(
        max_length=20,
        choices=ParticipationMode.choices,
        default=ParticipationMode.INDIVIDUAL,
        db_index=True,
    )
    team_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Nom souhaité de l'équipe lors de l'inscription (optionnel)",
    )
    answers = models.JSONField(
        default=dict,
        blank=True,
        help_text="Réponses aux questions personnalisées posées par l'organisateur",
    )
    status = models.CharField(
        max_length=20,
        choices=ApplicationStatus.choices,
        default=ApplicationStatus.PENDING,
        db_index=True,
    )
    rejection_reason = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_hackathon_applications",
    )
    terms_accepted = models.BooleanField(default=True)
    terms_accepted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "hackathon_applications"
        unique_together = ("hackathon", "applicant")
        ordering = ["-created_at"]
        verbose_name = "Hackathon Application"
        verbose_name_plural = "Hackathon Applications"

    def __str__(self):
        return f"{self.applicant.username} -> {self.hackathon.title} ({self.status})"
