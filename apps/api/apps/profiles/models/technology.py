from django.db import models
from django.utils.text import slugify

from common.models.base import BaseModel


class TechnologyCategory(models.TextChoices):
    FRONTEND = 'frontend', 'Frontend'
    BACKEND = 'backend', 'Backend'
    FULLSTACK = 'fullstack', 'Fullstack'
    MOBILE = 'mobile', 'Mobile'
    DEVOPS = 'devops', 'DevOps & Cloud'
    DATABASE = 'database', 'Database'
    AI_ML = 'ai_ml', 'AI & Machine Learning'
    SECURITY = 'security', 'Cybersecurity'
    BLOCKCHAIN = 'blockchain', 'Web3 & Blockchain'
    TESTING = 'testing', 'QA & Testing'
    TOOLING = 'tooling', 'Tooling & Infra'
    OTHER = 'other', 'Other'


class Technology(BaseModel):
    """
    Standardized technology, framework, language, or developer tool catalog.
    """
    name = models.CharField(max_length=100, unique=True, db_index=True)
    slug = models.SlugField(max_length=120, unique=True, db_index=True)
    category = models.CharField(
        max_length=50,
        choices=TechnologyCategory.choices,
        default=TechnologyCategory.OTHER,
        db_index=True
    )
    icon_url = models.URLField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    is_verified = models.BooleanField(default=True, db_index=True)
    usage_count = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        db_table = 'profiles_technologies'
        verbose_name = 'Technology'
        verbose_name_plural = 'Technologies'
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"
