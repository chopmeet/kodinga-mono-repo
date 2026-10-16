from django.db import models
from common.models.base import BaseModel


class TranslationCache(BaseModel):
    """
    Persistent cache for translations to avoid redundant provider calls and costs.
    Keyed uniquely by (content_hash, source_language, target_language).
    """

    content_hash = models.CharField(
        max_length=64,
        db_index=True,
        help_text="SHA-256 hash du contenu source original",
    )
    source_language = models.CharField(max_length=10, db_index=True)
    target_language = models.CharField(max_length=10, db_index=True)
    original_text = models.TextField(blank=True)
    translated_text = models.TextField()
    provider = models.CharField(max_length=30, default="gemini")
    model = models.CharField(max_length=100, blank=True)
    confidence = models.FloatField(default=1.0)
    hit_count = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "ai_translation_cache"
        unique_together = ("content_hash", "source_language", "target_language")
        indexes = [
            models.Index(fields=["content_hash", "target_language"]),
        ]
        verbose_name = "Translation Cache Entry"
        verbose_name_plural = "Translation Cache Entries"

    def __str__(self):
        return f"{self.source_language} -> {self.target_language} [{self.provider}]"
