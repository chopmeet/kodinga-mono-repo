from apps.profiles.models.profile import DeveloperProfile
from apps.profiles.models.technology import Technology
from common.models.base import BaseModel
from django.db import models


class DeveloperPortfolioProject(BaseModel):
    """
    Showcase projects highlighted on a developer's profile.
    """
    profile = models.ForeignKey(
        DeveloperProfile,
        on_delete=models.CASCADE,
        related_name='portfolio_projects',
        db_index=True
    )
    title = models.CharField(max_length=150, help_text="Titre du projet")
    description = models.TextField(blank=True, help_text="Présentation du projet, objectifs et architecture")
    project_url = models.URLField(max_length=500, blank=True, help_text="Lien vers la démo en ligne")
    repo_url = models.URLField(max_length=500, blank=True, help_text="Lien vers le dépôt GitHub / GitLab")
    thumbnail_url = models.URLField(max_length=500, blank=True, help_text="Capture d'écran ou miniature du projet")
    technologies = models.ManyToManyField(
        Technology,
        blank=True,
        related_name='portfolio_projects'
    )
    is_featured = models.BooleanField(default=False, help_text="Met en avant ce projet en tête du portfolio")
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'profiles_developer_portfolio_projects'
        verbose_name = 'Portfolio Project'
        verbose_name_plural = 'Portfolio Projects'
        ordering = ['-is_featured', 'order', '-created_at']

    def __str__(self):
        return f"{self.title} ({self.profile.user.username})"
