from common.models.base import BaseModel
from django.db import models

from apps.communities.models.community import Community


class SentimentRecord(BaseModel):
    """
    Persisted sentiment analytics for community engagement, moderation prioritization,
    and discussion trends.
    """

    content_hash = models.CharField(max_length=64, db_index=True)
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="ai_sentiment_records",
        db_index=True,
    )
    sentiment = models.CharField(
        max_length=20,
        db_index=True,
        help_text="positive, neutral, negative, mixed, uncertain",
    )
    score = models.FloatField(default=0.0)
    confidence = models.FloatField(default=1.0)
    reason = models.TextField(blank=True)
    provider = models.CharField(max_length=30, default="gemini")
    entity_type = models.CharField(max_length=50, blank=True)
    entity_id = models.CharField(max_length=64, blank=True)

    class Meta:
        db_table = "ai_sentiment_records"
        ordering = ["-created_at"]
        verbose_name = "Sentiment Record"
        verbose_name_plural = "Sentiment Records"

    def __str__(self):
        return f"{self.sentiment} ({self.score}) [{self.provider}]"
