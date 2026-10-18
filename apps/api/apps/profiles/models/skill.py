from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.profiles.models.profile import DeveloperProfile
from apps.profiles.models.technology import Technology
from common.models.base import BaseModel


class SkillLevel(models.TextChoices):
    BEGINNER = 'beginner', 'Débutant'
    INTERMEDIATE = 'intermediate', 'Intermédiaire'
    ADVANCED = 'advanced', 'Avancé'
    EXPERT = 'expert', 'Expert'


class DeveloperSkill(BaseModel):
    """
    Skill association between a developer profile and a specific technology.
    """
    profile = models.ForeignKey(
        DeveloperProfile,
        on_delete=models.CASCADE,
        related_name='skills',
        db_index=True
    )
    technology = models.ForeignKey(
        Technology,
        on_delete=models.CASCADE,
        related_name='developer_skills',
        db_index=True
    )
    level = models.CharField(
        max_length=20,
        choices=SkillLevel.choices,
        default=SkillLevel.INTERMEDIATE
    )
    years_of_experience = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(0), MaxValueValidator(60)]
    )
    is_highlighted = models.BooleanField(
        default=False,
        help_text="Met en avant cette compétence parmi les top skills du profil"
    )
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'profiles_developer_skills'
        verbose_name = 'Developer Skill'
        verbose_name_plural = 'Developer Skills'
        unique_together = ('profile', 'technology')
        ordering = ['-is_highlighted', 'order', 'technology__name']

    def __str__(self):
        return f"{self.profile.user.username} - {self.technology.name} ({self.get_level_display()})"
