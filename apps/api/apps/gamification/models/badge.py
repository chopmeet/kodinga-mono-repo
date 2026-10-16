from django.conf import settings
from django.db import models

from apps.communities.models.community import Community
from common.models.base import BaseModel


class BadgeCategory(models.TextChoices):
    GENERAL = "general", "Général"
    COMMUNITY = "community", "Communauté"
    COURSE = "course", "Apprentissage"
    EVENT = "event", "Événements & Live"
    CONTRIBUTION = "contribution", "Contribution & Entraide"


class Badge(BaseModel):
    """
    Represents an achievement badge unlockable by developers through
    platform engagement.
    """

    slug = models.SlugField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    description = models.TextField()
    icon_url = models.URLField(max_length=500, blank=True)
    category = models.CharField(
        max_length=30,
        choices=BadgeCategory.choices,
        default=BadgeCategory.GENERAL,
        db_index=True,
    )
    points_reward = models.PositiveIntegerField(
        default=50,
        help_text="Bonus de points de réputation attribué lors du déblocage",
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = "gamification_badges"
        verbose_name = "Badge"
        verbose_name_plural = "Badges"
        ordering = ["category", "name"]

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"


class UserBadge(BaseModel):
    """
    Links an awarded badge to a specific developer, optionally tied to a community.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="awarded_badges",
        db_index=True,
    )
    badge = models.ForeignKey(
        Badge,
        on_delete=models.CASCADE,
        related_name="user_awards",
        db_index=True,
    )
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="community_badges",
        db_index=True,
    )
    awarded_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "gamification_user_badges"
        verbose_name = "User Badge"
        verbose_name_plural = "User Badges"
        unique_together = ("user", "badge", "community")
        ordering = ["-awarded_at"]

    def __str__(self):
        return f"{self.user.username} - {self.badge.name}"
