from django.db import models
from django.utils import timezone

from common.models.base import BaseModel


class MetricType(models.TextChoices):
    COUNTER = 'counter', 'Compteur'
    GAUGE = 'gauge', 'Jauge instantanée'
    FINANCIAL = 'financial', 'Financier & Revenus'
    ENGAGEMENT = 'engagement', 'Engagement & Activité'


class PlatformMetric(BaseModel):
    """
    Historical platform metrics and aggregated KPI indicators for administration dashboards.
    """
    metric_name = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Clé identifiante de la métrique (ex: 'mrr', 'dau', 'posts_total', 'course_completions')."
    )
    metric_type = models.CharField(
        max_length=50,
        choices=MetricType.choices,
        default=MetricType.COUNTER,
        db_index=True,
        help_text="Catégorie ou nature de la métrique."
    )
    value = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        default=0.00,
        help_text="Valeur numérique scalaire de la métrique."
    )
    dimensions = models.JSONField(
        default=dict,
        blank=True,
        help_text="Dimensions contextuelles (ex: {'community_id': '...', 'country': 'SN'})."
    )
    period_start = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Début de la période d'agrégation si applicable."
    )
    period_end = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fin de la période d'agrégation si applicable."
    )
    recorded_at = models.DateTimeField(
        default=timezone.now,
        db_index=True,
        help_text="Horodatage d'enregistrement effectif."
    )

    class Meta:
        verbose_name = "Métrique Plateforme"
        verbose_name_plural = "Métriques Plateforme"
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['metric_name', 'recorded_at'], name='analytics_name_time_idx'),
            models.Index(fields=['metric_type', 'recorded_at'], name='analytics_type_time_idx'),
        ]

    def __str__(self) -> str:
        return f"{self.metric_name}: {self.value} ({self.recorded_at.isoformat()})"
