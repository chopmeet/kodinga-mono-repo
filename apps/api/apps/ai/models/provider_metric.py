from django.db import models
from common.models.base import BaseModel


class ProviderMetric(BaseModel):
    """
    Observability metric recording AI operation performance, latency,
    fallback frequency, and provider error tracking.
    """

    provider = models.CharField(max_length=30, db_index=True)
    operation = models.CharField(max_length=50, db_index=True)
    status = models.CharField(max_length=40, db_index=True)
    latency_ms = models.IntegerField(default=0)
    prompt_tokens = models.IntegerField(default=0)
    completion_tokens = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)

    class Meta:
        db_table = "ai_provider_metrics"
        ordering = ["-created_at"]
        verbose_name = "Provider Metric"
        verbose_name_plural = "Provider Metrics"

    def __str__(self):
        return f"{self.operation} via {self.provider} ({self.status}) - {self.latency_ms}ms"
