import logging
from datetime import timedelta
from typing import Any

from django.db.models import Avg
from django.utils import timezone

from apps.ai.models.provider_metric import ProviderMetric
from apps.ai.providers.circuit_breaker import gemini_circuit_breaker

logger = logging.getLogger(__name__)


class ProviderHealthService:
    """
    Health and observability service monitoring Gemini and OpenAI provider availability,
    rate-limits, quota exhaustion, circuit breaker state, and latency metrics.
    """

    @classmethod
    def get_health_status(cls) -> dict[str, Any]:
        cb_status = gemini_circuit_breaker.get_status()
        now = timezone.now()
        since_24h = now - timedelta(hours=24)

        # Aggregate metrics from ProviderMetric
        total_metrics = ProviderMetric.objects.filter(created_at__gte=since_24h)
        total_count = total_metrics.count()

        gemini_metrics = total_metrics.filter(provider="gemini")
        openai_metrics = total_metrics.filter(provider="openai")

        gemini_count = gemini_metrics.count()
        openai_count = openai_metrics.count()
        fallback_count = total_metrics.filter(status="fallback_success").count()
        all_failed_count = total_metrics.filter(status="all_failed").count()

        gemini_avg_latency = (
            gemini_metrics.aggregate(Avg("latency_ms"))["latency_ms__avg"] or 0.0
        )
        openai_avg_latency = (
            openai_metrics.aggregate(Avg("latency_ms"))["latency_ms__avg"] or 0.0
        )

        return {
            "status": "healthy" if cb_status["is_available"] else "degraded",
            "primary_provider": {
                "name": "gemini",
                "is_available": cb_status["is_available"],
                "circuit_breaker": cb_status,
                "requests_24h": gemini_count,
                "avg_latency_ms": round(gemini_avg_latency, 1),
            },
            "fallback_provider": {
                "name": "openai",
                "is_available": True,
                "requests_24h": openai_count,
                "avg_latency_ms": round(openai_avg_latency, 1),
            },
            "system_metrics": {
                "total_ai_requests_24h": total_count,
                "fallback_count_24h": fallback_count,
                "all_failed_count_24h": all_failed_count,
                "fallback_rate_percent": (
                    round((fallback_count / total_count) * 100, 2)
                    if total_count > 0
                    else 0.0
                ),
            },
            "checked_at": now.isoformat(),
        }
