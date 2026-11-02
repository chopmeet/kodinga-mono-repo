from apps.communities.models.community import Community
from apps.profiles.models.technology import Technology
from common.models.base import BaseModel
from django.conf import settings
from django.db import models
from django.utils.text import slugify


class ProjectStatus(models.TextChoices):
    DRAFT = "draft", "Brouillon"
    PUBLISHED = "published", "Publié"
    ARCHIVED = "archived", "Archivé"


class Project(BaseModel):
    """
    Developer project showcase and community portfolio project.
    """

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="projects",
        db_index=True,
    )
    community = models.ForeignKey(
        Community,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="showcase_projects",
        db_index=True,
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    tagline = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    technologies = models.ManyToManyField(
        Technology,
        blank=True,
        related_name="projects",
    )
    repository_url = models.URLField(max_length=1000, blank=True)
    demo_url = models.URLField(max_length=1000, blank=True)
    cover_image_url = models.URLField(max_length=1000, blank=True)
    demo_images = models.JSONField(
        default=list,
        blank=True,
        help_text="Liste des URLs d'images ou captures d'écran de démonstration",
    )

    status = models.CharField(
        max_length=20,
        choices=ProjectStatus.choices,
        default=ProjectStatus.PUBLISHED,
        db_index=True,
    )
    upvotes_count = models.PositiveIntegerField(default=0, db_index=True)
    views_count = models.PositiveIntegerField(default=0)
    is_featured = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = "projects_projects"
        ordering = ["-upvotes_count", "-created_at"]

    def __str__(self):
        return f"{self.title} by {self.owner.username}"

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.title) or "project"
            candidate = base_slug
            counter = 1
            while Project.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
                candidate = f"{base_slug}-{counter}"
                counter += 1
            self.slug = candidate
        super().save(*args, **kwargs)
