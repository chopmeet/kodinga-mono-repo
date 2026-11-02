from apps.communities.models.community import Community
from apps.profiles.models.technology import Technology
from common.models.base import BaseModel
from django.conf import settings
from django.db import models
from django.utils.text import slugify


class OpportunityType(models.TextChoices):
    FULL_TIME = "full_time", "CDI / Plein temps"
    PART_TIME = "part_time", "Temps partiel"
    CONTRACT = "contract", "Contrat / CDD"
    FREELANCE = "freelance", "Freelance / Mission"
    INTERNSHIP = "internship", "Stage"
    BOUNTY = "bounty", "Bounty / Prime Open Source"


class WorkplaceType(models.TextChoices):
    REMOTE = "remote", "Télétravail total"
    HYBRID = "hybrid", "Hybride"
    ONSITE = "onsite", "Sur site"


class ExperienceLevel(models.TextChoices):
    ALL = "all", "Tous niveaux"
    JUNIOR = "junior", "Junior (0-2 ans)"
    MID = "mid", "Intermédiaire (2-5 ans)"
    SENIOR = "senior", "Senior (5+ ans)"
    LEAD = "lead", "Lead / Staff Architect"


class OpportunityStatus(models.TextChoices):
    OPEN = "open", "Ouverte"
    CLOSED = "closed", "Clôturée"
    DRAFT = "draft", "Brouillon"


class Opportunity(BaseModel):
    """
    Tech job, freelance mission, internship or bug bounty opportunity.
    """

    poster = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="posted_opportunities",
        db_index=True,
    )
    community = models.ForeignKey(
        Community,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="opportunities",
        db_index=True,
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    company_name = models.CharField(max_length=255)
    company_logo_url = models.URLField(max_length=1000, blank=True)
    company_website = models.URLField(max_length=1000, blank=True)

    opportunity_type = models.CharField(
        max_length=20,
        choices=OpportunityType.choices,
        default=OpportunityType.FULL_TIME,
        db_index=True,
    )
    workplace_type = models.CharField(
        max_length=20,
        choices=WorkplaceType.choices,
        default=WorkplaceType.REMOTE,
        db_index=True,
    )
    location = models.CharField(max_length=255, blank=True, default="Remote")

    salary_min = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    salary_max = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=10, default="XOF")

    experience_level = models.CharField(
        max_length=20,
        choices=ExperienceLevel.choices,
        default=ExperienceLevel.ALL,
        db_index=True,
    )

    description = models.TextField()
    requirements = models.TextField(blank=True)
    technologies = models.ManyToManyField(
        Technology,
        blank=True,
        related_name="opportunities",
    )

    apply_url = models.URLField(max_length=1000, blank=True)
    apply_email = models.EmailField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=OpportunityStatus.choices,
        default=OpportunityStatus.OPEN,
        db_index=True,
    )
    views_count = models.PositiveIntegerField(default=0)
    applications_count = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "opportunities_opportunities"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} at {self.company_name}"

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(f"{self.company_name}-{self.title}") or "opportunity"
            candidate = base_slug
            counter = 1
            while Opportunity.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
                candidate = f"{base_slug}-{counter}"
                counter += 1
            self.slug = candidate
        super().save(*args, **kwargs)
