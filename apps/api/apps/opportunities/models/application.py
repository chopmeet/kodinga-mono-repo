from django.conf import settings
from django.db import models

from apps.opportunities.models.opportunity import Opportunity
from common.models.base import BaseModel


class ApplicationStatus(models.TextChoices):
    PENDING = "pending", "En attente"
    REVIEWING = "reviewing", "En cours d'examen"
    SHORTLISTED = "shortlisted", "Présélectionné"
    ACCEPTED = "accepted", "Accepté"
    REJECTED = "rejected", "Refusé"


class OpportunityApplication(BaseModel):
    """
    Candidate application to a job or freelance mission.
    """

    opportunity = models.ForeignKey(
        Opportunity,
        on_delete=models.CASCADE,
        related_name="applications",
        db_index=True,
    )
    applicant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_applications",
        db_index=True,
    )
    resume_url = models.URLField(max_length=1000, blank=True)
    cover_letter = models.TextField(blank=True)
    portfolio_url = models.URLField(max_length=1000, blank=True)
    status = models.CharField(
        max_length=20,
        choices=ApplicationStatus.choices,
        default=ApplicationStatus.PENDING,
        db_index=True,
    )

    class Meta:
        db_table = "opportunities_applications"
        unique_together = ("opportunity", "applicant")
        ordering = ["-created_at"]

    def __str__(self):
        return f"Application by {self.applicant.username} for {self.opportunity.title}"
