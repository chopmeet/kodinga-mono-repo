from common.models.base import BaseModel
from django.db import models
from django.utils.text import slugify


class CommunityCategory(BaseModel):
    """
    Thematic category for organizing and discovering tech communities.
    """
    name = models.CharField(max_length=100, unique=True, db_index=True)
    slug = models.SlugField(max_length=120, unique=True, db_index=True)
    description = models.TextField(blank=True)
    icon_url = models.URLField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'communities_categories'
        verbose_name = 'Community Category'
        verbose_name_plural = 'Community Categories'
        ordering = ['order', 'name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
