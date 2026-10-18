from django.db import models

from apps.communities.models.community import Community
from common.models.base import BaseModel


class CommunityRule(BaseModel):
    """
    Charter rules and moderation guidelines for a community.
    """
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name='rules',
        db_index=True
    )
    title = models.CharField(max_length=200, help_text="Titre ou règle courte")
    description = models.TextField(blank=True, help_text="Explications et détails de la règle")
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'communities_rules'
        verbose_name = 'Community Rule'
        verbose_name_plural = 'Community Rules'
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"Rule {self.order + 1}: {self.title} ({self.community.name})"
