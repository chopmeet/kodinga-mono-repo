from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.communities.models.community import Community
from apps.profiles.models.technology import Technology
from common.models.base import BaseModel


class HackathonFormat(models.TextChoices):
    ONLINE = "online", "En ligne"
    IN_PERSON = "in_person", "Présentiel"
    HYBRID = "hybrid", "Hybride"


class HackathonStatus(models.TextChoices):
    DRAFT = "draft", "Brouillon"
    PUBLISHED = "published", "Publié"
    REGISTRATION_OPEN = "registration_open", "Inscriptions ouvertes"
    REGISTRATION_CLOSED = "registration_closed", "Inscriptions closes"
    IN_PROGRESS = "in_progress", "Hackathon en cours"
    SUBMISSION_CLOSED = "submission_closed", "Soumissions closes"
    JUDGING = "judging", "Évaluations en cours"
    COMPLETED = "completed", "Terminé & Résultats publiés"
    CANCELLED = "cancelled", "Annulé"


class Hackathon(BaseModel):
    """
    Hackathon and coding challenge hosted inside a community.
    """

    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name="hackathons",
        db_index=True,
    )
    organizer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="organized_hackathons",
        db_index=True,
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, db_index=True)
    tagline = models.CharField(max_length=255, blank=True)
    description = models.TextField()
    cover_image_url = models.URLField(max_length=1000, blank=True)

    format = models.CharField(
        max_length=20,
        choices=HackathonFormat.choices,
        default=HackathonFormat.ONLINE,
        db_index=True,
    )
    venue_name = models.CharField(max_length=255, blank=True)
    venue_address = models.CharField(max_length=500, blank=True)
    venue_city = models.CharField(max_length=100, blank=True)
    venue_country = models.CharField(max_length=100, blank=True)
    location_url = models.URLField(
        max_length=1000,
        blank=True,
        help_text="Lien en ligne (LiveKit, Discord, Zoom, YouTube)",
    )

    main_language = models.CharField(max_length=10, default="fr")
    theme = models.CharField(max_length=255, blank=True)
    technologies = models.ManyToManyField(
        Technology,
        blank=True,
        related_name="hackathons",
    )
    target_audience = models.CharField(max_length=255, blank=True)
    prerequisites = models.TextField(blank=True)
    rules_url = models.URLField(max_length=1000, blank=True)
    terms_and_conditions = models.TextField(blank=True)

    # Schedule & Deadlines
    registration_start = models.DateTimeField(db_index=True)
    registration_end = models.DateTimeField(db_index=True)
    start_time = models.DateTimeField(db_index=True)
    submission_deadline = models.DateTimeField(db_index=True)
    judging_end = models.DateTimeField(db_index=True)
    results_announced_at = models.DateTimeField(null=True, blank=True)
    timezone = models.CharField(max_length=50, default="UTC")

    # Participation Rules
    is_member_only = models.BooleanField(
        default=False,
        help_text="Réservé uniquement aux membres actifs de la communauté",
    )
    allow_teams = models.BooleanField(default=True)
    min_team_size = models.PositiveIntegerField(default=1)
    max_team_size = models.PositiveIntegerField(default=4)
    max_participants = models.PositiveIntegerField(null=True, blank=True)
    auto_accept_applications = models.BooleanField(
        default=True,
        help_text="Accepte automatiquement les candidatures sans revue manuelle préalable",
    )
    custom_registration_questions = models.JSONField(
        default=list,
        blank=True,
        help_text="Liste des questions spécifiques du formulaire de candidature",
    )

    # Submission Requirements
    require_demo_url = models.BooleanField(default=False)
    require_video_url = models.BooleanField(default=False)
    require_repo_url = models.BooleanField(default=True)
    allowed_file_types = models.JSONField(
        default=list,
        blank=True,
        help_text="Liste blanche des extensions autorisées (ex: ['pdf', 'png', 'jpg', 'zip'])",
    )
    max_file_size_mb = models.PositiveIntegerField(default=25)
    max_files_count = models.PositiveIntegerField(default=5)
    custom_submission_questions = models.JSONField(
        default=list,
        blank=True,
        help_text="Questions obligatoires ou facultatives pour la soumission de projet",
    )

    # Lifecycle & Status
    status = models.CharField(
        max_length=30,
        choices=HackathonStatus.choices,
        default=HackathonStatus.DRAFT,
        db_index=True,
    )
    results_published = models.BooleanField(default=False, db_index=True)
    results_published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "hackathons"
        unique_together = ("community", "slug")
        ordering = ["-created_at"]
        verbose_name = "Hackathon"
        verbose_name_plural = "Hackathons"

    def __str__(self):
        return f"{self.title} ({self.community.name})"

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.title) or "hackathon"
            candidate = base_slug
            count = 1
            while Hackathon.objects.filter(
                community=self.community, slug=candidate
            ).exclude(pk=self.pk).exists():
                candidate = f"{base_slug}-{count}"
                count += 1
            self.slug = candidate
        super().save(*args, **kwargs)

    @property
    def is_registration_open(self) -> bool:
        """
        Registration is open only when the hackathon is published or explicitly in
        `registration_open` status AND current server time is within
        `[registration_start, registration_end]`.
        """
        if self.status not in [
            HackathonStatus.PUBLISHED,
            HackathonStatus.REGISTRATION_OPEN,
        ]:
            return False
        now = timezone.now()
        return self.registration_start <= now <= self.registration_end

    @property
    def is_submission_open(self) -> bool:
        if self.status in [HackathonStatus.CANCELLED, HackathonStatus.DRAFT]:
            return False
        now = timezone.now()
        if self.status == HackathonStatus.IN_PROGRESS:
            return now <= self.submission_deadline
        return self.start_time <= now <= self.submission_deadline

    @property
    def participants_count(self) -> int:
        """
        Returns the number of accepted participants (excludes withdrawn/rejected).
        """
        return self.applications.filter(status="accepted").count()

    @property
    def applications_count(self) -> int:
        """
        Returns the number of active applications (accepted, pending, waitlisted).
        """
        return self.applications.exclude(status__in=["withdrawn", "rejected"]).count()
