from django.db import models
from common.models.base import BaseModel
from apps.profiles.models.profile import DeveloperProfile


class DeveloperEducation(BaseModel):
    """
    Degrees, certifications, and academic background of a developer.
    """
    profile = models.ForeignKey(
        DeveloperProfile,
        on_delete=models.CASCADE,
        related_name='educations',
        db_index=True
    )
    institution = models.CharField(max_length=150, help_text="Nom de l'école ou université")
    degree = models.CharField(max_length=150, help_text="Diplôme (ex: Master Informatique, BootCamp FullStack)")
    field_of_study = models.CharField(max_length=150, blank=True, help_text="Spécialité (ex: Génie Logiciel)")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=False)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'profiles_developer_educations'
        verbose_name = 'Developer Education'
        verbose_name_plural = 'Developer Educations'
        ordering = ['-start_date', '-created_at']

    def __str__(self):
        return f"{self.degree} - {self.institution} ({self.profile.user.username})"
