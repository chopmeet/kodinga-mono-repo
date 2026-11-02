from common.models.base import BaseModel
from django.conf import settings
from django.db import models
from django.utils.text import slugify

from apps.hackathons.models.hackathon import Hackathon
from apps.hackathons.models.team import HackathonTeam
from apps.profiles.models.technology import Technology


class SubmissionStatus(models.TextChoices):
    DRAFT = "draft", "Brouillon"
    SUBMITTED = "submitted", "Soumis officiellement"


class SubmissionFileType(models.TextChoices):
    PRESENTATION_PDF = "presentation_pdf", "PDF de présentation"
    SCREENSHOT = "screenshot", "Capture d'écran / Image"
    TECHNICAL_DOC = "technical_doc", "Documentation technique"
    ARCHIVE = "archive", "Archive ZIP"
    OTHER = "other", "Autre pièce jointe"


class HackathonSubmission(BaseModel):
    """
    Project submitted by a participant or team for hackathon evaluation.
    """

    hackathon = models.ForeignKey(
        Hackathon,
        on_delete=models.CASCADE,
        related_name="submissions",
        db_index=True,
    )
    team = models.ForeignKey(
        HackathonTeam,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="submissions",
        db_index=True,
    )
    applicant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="hackathon_submissions",
        db_index=True,
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, db_index=True)
    tagline = models.CharField(max_length=255, blank=True)
    description = models.TextField()
    problem_statement = models.TextField(blank=True)
    solution_statement = models.TextField(blank=True)
    target_audience = models.CharField(max_length=255, blank=True)
    technologies = models.ManyToManyField(
        Technology,
        blank=True,
        related_name="hackathon_submissions",
    )

    # External URLs
    demo_url = models.URLField(max_length=1000, blank=True)
    video_url = models.URLField(max_length=1000, blank=True)
    repository_url = models.URLField(max_length=1000, blank=True)
    gitlab_url = models.URLField(max_length=1000, blank=True)
    extra_links = models.JSONField(
        default=list,
        blank=True,
        help_text="Liens complémentaires (ex: prototype Figma, slide deck)",
    )
    custom_answers = models.JSONField(
        default=dict,
        blank=True,
        help_text="Réponses aux questions spécifiques du hackathon",
    )

    # Status & Timestamps
    status = models.CharField(
        max_length=20,
        choices=SubmissionStatus.choices,
        default=SubmissionStatus.DRAFT,
        db_index=True,
    )
    is_final = models.BooleanField(default=False, db_index=True)
    submitted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    # Consolidated Results Cache
    total_score = models.DecimalField(
        max_digits=6, decimal_places=2, default=0.0, db_index=True
    )
    evaluations_count = models.PositiveIntegerField(default=0)
    rank = models.PositiveIntegerField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = "hackathon_submissions"
        unique_together = ("hackathon", "slug")
        ordering = ["-total_score", "-submitted_at"]
        verbose_name = "Hackathon Submission"
        verbose_name_plural = "Hackathon Submissions"

    def __str__(self):
        owner_name = self.team.name if self.team else self.applicant.username
        return f"{self.title} ({owner_name}) - {self.hackathon.title}"

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.title) or "project"
            candidate = base_slug
            count = 1
            while HackathonSubmission.objects.filter(
                hackathon=self.hackathon, slug=candidate
            ).exclude(pk=self.pk).exists():
                candidate = f"{base_slug}-{count}"
                count += 1
            self.slug = candidate
        super().save(*args, **kwargs)


class HackathonSubmissionFile(BaseModel):
    """
    Uploaded files attached to a hackathon project submission.
    """

    submission = models.ForeignKey(
        HackathonSubmission,
        on_delete=models.CASCADE,
        related_name="files",
        db_index=True,
    )
    file_name = models.CharField(max_length=255)
    file_url = models.URLField(max_length=1000)
    file_size = models.BigIntegerField(default=0, help_text="Taille en octets")
    mime_type = models.CharField(max_length=100)
    file_type = models.CharField(
        max_length=30,
        choices=SubmissionFileType.choices,
        default=SubmissionFileType.OTHER,
        db_index=True,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="uploaded_submission_files",
    )

    class Meta:
        db_table = "hackathon_submission_files"
        ordering = ["-created_at"]
        verbose_name = "Hackathon Submission File"
        verbose_name_plural = "Hackathon Submission Files"

    def __str__(self):
        return f"{self.file_name} ({self.submission.title})"
