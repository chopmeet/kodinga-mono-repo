from django.db import models

from apps.profiles.models.profile import DeveloperProfile
from apps.profiles.models.technology import Technology
from common.models.base import BaseModel


class EmploymentType(models.TextChoices):
    FULL_TIME = 'full_time', 'CDI / Temps plein'
    PART_TIME = 'part_time', 'Temps partiel'
    FREELANCE = 'freelance', 'Freelance / Indépendant'
    CONTRACT = 'contract', 'CDD / Prestation'
    INTERNSHIP = 'internship', 'Stage / Alternance'
    APPRENTICESHIP = 'apprenticeship', 'Apprentissage'


class DeveloperExperience(BaseModel):
    """
    Work experience and career history of a developer.
    """
    profile = models.ForeignKey(
        DeveloperProfile,
        on_delete=models.CASCADE,
        related_name='experiences',
        db_index=True
    )
    title = models.CharField(max_length=150, help_text="Poste occupé (ex: Lead Backend Developer)")
    company_name = models.CharField(max_length=150, help_text="Nom de l'entreprise ou du client")
    company_url = models.URLField(max_length=300, blank=True)
    location = models.CharField(max_length=100, blank=True, help_text="Paris, France / Remote")
    employment_type = models.CharField(
        max_length=30,
        choices=EmploymentType.choices,
        default=EmploymentType.FULL_TIME
    )
    is_remote = models.BooleanField(default=False)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=False)
    description = models.TextField(blank=True, help_text="Missions et réalisations clés")
    technologies = models.ManyToManyField(
        Technology,
        blank=True,
        related_name='experiences'
    )

    class Meta:
        db_table = 'profiles_developer_experiences'
        verbose_name = 'Developer Experience'
        verbose_name_plural = 'Developer Experiences'
        ordering = ['-start_date', '-created_at']

    def __str__(self):
        return f"{self.title} chez {self.company_name} ({self.profile.user.username})"
