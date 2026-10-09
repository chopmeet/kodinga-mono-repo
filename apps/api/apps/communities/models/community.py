from django.conf import settings
from django.db import models
from django.utils.text import slugify
from common.models.base import BaseModel
from apps.communities.models.category import CommunityCategory


class CommunityPrivacy(models.TextChoices):
    PUBLIC = 'public', 'Publique (visible et accessible à tous)'
    PRIVATE = 'private', 'Privée (sur approbation ou invitation)'
    SECRET = 'secret', 'Secrète (masquée de la recherche)'


class CommunityPricing(models.TextChoices):
    FREE = 'free', 'Gratuit'
    PAID = 'paid', 'Payant (Abonnement requis)'


class Community(BaseModel):
    """
    Core multi-tenant Community / Space entity on Kodinga.
    """
    name = models.CharField(max_length=150, db_index=True)
    slug = models.SlugField(max_length=160, unique=True, db_index=True)
    tagline = models.CharField(max_length=255, blank=True, help_text="Accroche courte")
    description = models.TextField(blank=True, help_text="Présentation complète au format Markdown")

    # Relationships
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='owned_communities',
        db_index=True
    )
    category = models.ForeignKey(
        CommunityCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='communities',
        db_index=True
    )

    # Privacy & Access
    privacy_type = models.CharField(
        max_length=20,
        choices=CommunityPrivacy.choices,
        default=CommunityPrivacy.PUBLIC,
        db_index=True
    )
    pricing_type = models.CharField(
        max_length=20,
        choices=CommunityPricing.choices,
        default=CommunityPricing.FREE,
        db_index=True
    )

    # Visuals & Branding
    avatar_url = models.URLField(max_length=500, blank=True, default="")
    banner_url = models.URLField(max_length=500, blank=True, default="")
    brand_color = models.CharField(max_length=10, default='#3B82F6')

    # Socials & External Links
    website_url = models.URLField(max_length=300, blank=True, default="")
    github_url = models.URLField(max_length=300, blank=True, default="")
    discord_url = models.URLField(max_length=300, blank=True, default="")
    twitter_url = models.URLField(max_length=300, blank=True, default="")
    whatsapp_url = models.URLField(max_length=300, blank=True, default="")
    telegram_url = models.URLField(max_length=300, blank=True, default="")

    # Flags & Badges
    is_verified = models.BooleanField(default=False, db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    # Counters (denormalized for high read performance)
    members_count = models.PositiveIntegerField(default=1, db_index=True)
    posts_count = models.PositiveIntegerField(default=0)
    courses_count = models.PositiveIntegerField(default=0)
    events_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'communities_communities'
        verbose_name = 'Community'
        verbose_name_plural = 'Communities'
        ordering = ['-members_count', '-created_at']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} (@{self.slug})"
