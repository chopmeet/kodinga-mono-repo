from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from common.models.base import BaseModel


class AvailabilityStatus(models.TextChoices):
    AVAILABLE = 'available', 'Disponible'
    OPEN_TO_OFFERS = 'open_to_offers', 'À l’écoute du marché'
    BUSY = 'busy', 'Occupé'
    UNAVAILABLE = 'unavailable', 'Non disponible'


class DeveloperProfile(BaseModel):
    """
    Rich developer profile linked 1-to-1 with a User account.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
        db_index=True
    )
    headline = models.CharField(
        max_length=140,
        blank=True,
        help_text="Titre professionnel ou accroche courte (ex: Senior Fullstack Python & React Developer)"
    )
    bio = models.TextField(
        blank=True,
        help_text="Biographie détaillée au format Markdown ou texte enrichi"
    )
    avatar_url = models.URLField(max_length=500, blank=True)
    banner_url = models.URLField(max_length=500, blank=True)
    
    # Location & Origin
    location = models.CharField(max_length=100, blank=True, help_text="Ville, Région ou Pays")
    country_code = models.CharField(max_length=3, blank=True)
    
    # Links & Socials
    website_url = models.URLField(max_length=300, blank=True)
    github_username = models.CharField(max_length=100, blank=True)
    gitlab_username = models.CharField(max_length=100, blank=True)
    linkedin_url = models.URLField(max_length=300, blank=True)
    twitter_handle = models.CharField(max_length=100, blank=True)
    youtube_url = models.URLField(max_length=300, blank=True)
    discord_handle = models.CharField(max_length=100, blank=True)
    custom_links = models.JSONField(
        default=list,
        blank=True,
        help_text="Liste de liens personnalisés [{'title': '...', 'url': '...'}]"
    )

    # Professional Preferences & Status
    years_of_experience = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(60)]
    )
    availability_status = models.CharField(
        max_length=30,
        choices=AvailabilityStatus.choices,
        default=AvailabilityStatus.AVAILABLE,
        db_index=True
    )
    hourly_rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    currency = models.CharField(max_length=3, default='USD')
    
    # Visibility & Flags
    is_public = models.BooleanField(default=True, db_index=True)
    is_mentor = models.BooleanField(default=False, db_index=True)
    open_to_freelance = models.BooleanField(default=True)
    open_to_relocation = models.BooleanField(default=False)
    open_to_remote = models.BooleanField(default=True)

    # Stats & Engagement
    views_count = models.PositiveIntegerField(default=0, db_index=True)
    reputation_points = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        db_table = 'profiles_developer_profiles'
        verbose_name = 'Developer Profile'
        verbose_name_plural = 'Developer Profiles'
        ordering = ['-reputation_points', '-created_at']

    def __str__(self):
        return f"Profile of {self.user.username}"

    @property
    def display_name(self) -> str:
        full_name = self.user.get_full_name()
        return full_name if full_name else self.user.username

    @property
    def completion_percentage(self) -> int:
        """
        Computes profile completion rate dynamically for gamification & onboarding.
        """
        score = 0
        total = 8
        if self.headline: score += 1
        if self.bio: score += 1
        if self.avatar_url: score += 1
        if self.location: score += 1
        if self.github_username or self.gitlab_username: score += 1
        if self.skills.exists(): score += 1
        if self.experiences.exists(): score += 1
        if self.portfolio_projects.exists(): score += 1
        return int((score / total) * 100)
