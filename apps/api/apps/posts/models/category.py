from django.db import models
from django.utils.text import slugify

from apps.communities.models.community import Community
from common.models.base import BaseModel


class PostCategory(BaseModel):
    """
    Channel / Topic category within a community feed (e.g. #general, #help, #showcase, #announcements).
    """
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name='post_categories',
        db_index=True
    )
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True, help_text="Emoji ou icône Lucide")
    is_default = models.BooleanField(default=False)
    is_restricted = models.BooleanField(
        default=False,
        help_text="Si activé, seuls les modérateurs et administrateurs peuvent publier ici (ex: #annonces)"
    )
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'posts_categories'
        verbose_name = 'Post Category'
        verbose_name_plural = 'Post Categories'
        unique_together = ('community', 'slug')
        ordering = ['order', 'name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"#{self.slug} ({self.community.name})"
