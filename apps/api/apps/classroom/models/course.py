from django.conf import settings
from django.db import models
from common.models.base import BaseModel
from apps.communities.models.community import Community


class CourseLevel(models.TextChoices):
    BEGINNER = 'beginner', 'Débutant'
    INTERMEDIATE = 'intermediate', 'Intermédiaire'
    ADVANCED = 'advanced', 'Avancé'
    ALL_LEVELS = 'all_levels', 'Tous niveaux'


class Course(BaseModel):
    """
    Online course / classroom program within a community.
    """
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name='courses',
        db_index=True
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='authored_courses',
        db_index=True
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, db_index=True)
    description = models.TextField(blank=True)
    level = models.CharField(
        max_length=30,
        choices=CourseLevel.choices,
        default=CourseLevel.ALL_LEVELS,
        db_index=True
    )
    thumbnail_url = models.URLField(blank=True, max_length=500)
    is_published = models.BooleanField(default=False, db_index=True)
    is_sequential = models.BooleanField(
        default=True,
        help_text="Si activé, chaque leçon doit être complétée pour débloquer la suivante"
    )
    order = models.PositiveIntegerField(default=0, db_index=True)
    
    # Denormalized counters
    modules_count = models.PositiveIntegerField(default=0)
    lessons_count = models.PositiveIntegerField(default=0)
    duration_seconds = models.PositiveIntegerField(
        default=0,
        help_text="Durée totale estimée du cours en secondes"
    )

    class Meta:
        db_table = 'classroom_courses'
        verbose_name = 'Course'
        verbose_name_plural = 'Courses'
        unique_together = ('community', 'slug')
        ordering = ['order', '-created_at']

    def __str__(self):
        return f"{self.title} ({self.community.name})"

    @property
    def duration_minutes(self) -> int:
        return self.duration_seconds // 60
