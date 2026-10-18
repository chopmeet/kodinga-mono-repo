import logging
import time
from typing import Any, Optional

from django.conf import settings

from apps.ai.providers.circuit_breaker import (
    QuotaCircuitBreaker,
    gemini_circuit_breaker,
)
from apps.ai.providers.exceptions import (
    AllProvidersFailedError,
    ConfigurationError,
    QuotaExhaustedError,
    RateLimitError,
    RecoverableProviderError,
    SafetyRejectionError,
)
from apps.ai.providers.gemini import GeminiAdapter
from apps.ai.providers.openai_adapter import OpenAIAdapter
from apps.ai.schemas import (
    AssistantChatResult,
    CommunityAnalysisResult,
    CommunityProposalResult,
    CommunityRecommendationResult,
    ContentSuggestionResult,
    LanguageDetectionResult,
    ModerationResult,
    PolicyViolationResult,
    SentimentResult,
    TranslationResult,
)

logger = logging.getLogger(__name__)


class ProviderRouter:
    """
    Central AI Provider Router implementing the Gemini-First architecture with OpenAI Fallback.
    Handles automatic failover, circuit breaker checking, bounded retries, and observability metrics.
    """

    def __init__(
        self,
        gemini_adapter: Optional[GeminiAdapter] = None,
        openai_adapter: Optional[OpenAIAdapter] = None,
        circuit_breaker: Optional[QuotaCircuitBreaker] = None,
    ):
        self.gemini = gemini_adapter or GeminiAdapter()
        self.openai = openai_adapter or OpenAIAdapter()
        self.circuit_breaker = circuit_breaker or gemini_circuit_breaker
        self.fallback_enabled = getattr(settings, "AI_FALLBACK_ENABLED", True)
        self.max_retries = getattr(settings, "AI_MAX_RETRIES", 1)

    def _record_metric(
        self,
        provider: str,
        operation: str,
        status: str,
        latency_ms: int,
        error_message: str = "",
    ) -> None:
        """Records metric asynchronously or via database without throwing exceptions."""
        try:
            from apps.ai.models.provider_metric import ProviderMetric

            ProviderMetric.objects.create(
                provider=provider,
                operation=operation,
                status=status,
                latency_ms=latency_ms,
                error_message=error_message[:1000] if error_message else "",
            )
        except Exception:
            # Model or DB might not be initialized yet (e.g. during migrations or unit tests)
            pass

    def _execute_with_fallback(self, operation: str, method_name: str, *args, **kwargs) -> Any:
        start_time = time.time()
        gemini_error = None
        attempt_gemini = self.circuit_breaker.can_attempt()

        # -------------------------------------------------------------
        # STEP 1: Attempt Gemini (if circuit breaker is not OPEN)
        # -------------------------------------------------------------
        if attempt_gemini:
            retry_count = 0
            while retry_count <= self.max_retries:
                call_start = time.time()
                try:
                    target_func = getattr(self.gemini, method_name)
                    result = target_func(*args, **kwargs)
                    latency = int((time.time() - call_start) * 1000)

                    self.circuit_breaker.record_success()
                    self._record_metric(
                        provider="gemini",
                        operation=operation,
                        status="success",
                        latency_ms=latency,
                    )
                    return result

                except SafetyRejectionError as e:
                    # Legitimate moderation rejection - DO NOT fallback!
                    latency = int((time.time() - call_start) * 1000)
                    self._record_metric(
                        provider="gemini",
                        operation=operation,
                        status="safety_rejection",
                        latency_ms=latency,
                    )
                    logger.info(f"[{operation}] Gemini safety rejection is a policy decision. Returning rejection.")
                    if method_name == "moderate_content":
                        return ModerationResult(
                            decision="reject",
                            flagged=True,
                            categories=["severe_safety_violation"],
                            confidence=1.0,
                            reason=str(e),
                            provider="gemini",
                        )
                    raise

                except QuotaExhaustedError as e:
                    # Quota exhausted: open circuit breaker and break retry loop
                    gemini_error = e
                    self.circuit_breaker.record_quota_exhausted(str(e))
                    logger.warning(
                        f"[{operation}] Gemini quota exhausted. Circuit breaker opened. Switching to fallback."
                    )
                    break

                except ConfigurationError as e:
                    # Configuration problem (e.g. invalid key): log alert and do not retry Gemini
                    gemini_error = e
                    logger.critical(
                        f"[{operation}] Gemini configuration error. Please verify GEMINI_API_KEY. Switching to fallback: {e}"
                    )
                    break

                except (RateLimitError, RecoverableProviderError) as e:
                    gemini_error = e
                    retry_count += 1
                    if retry_count <= self.max_retries:
                        time.sleep(0.3 * retry_count)  # Brief backoff
                    else:
                        self.circuit_breaker.record_transient_error(str(e))
                        logger.warning(
                            f"[{operation}] Gemini failed after {self.max_retries} retries ({type(e).__name__}: {e}). Switching to fallback."
                        )
                except Exception as e:
                    gemini_error = e
                    self.circuit_breaker.record_transient_error(str(e))
                    logger.warning(f"[{operation}] Gemini unexpected error ({e}). Switching to fallback.")
                    break
        else:
            logger.info(
                f"[{operation}] Gemini quota circuit breaker is OPEN. Directly routing to OpenAI fallback."
            )
            gemini_error = QuotaExhaustedError("Gemini circuit breaker is OPEN (quota exhausted)")

        # -------------------------------------------------------------
        # STEP 2: Fallback to OpenAI
        # -------------------------------------------------------------
        if not self.fallback_enabled:
            total_latency = int((time.time() - start_time) * 1000)
            self._record_metric(
                provider="gemini",
                operation=operation,
                status="failed_no_fallback",
                latency_ms=total_latency,
                error_message=str(gemini_error),
            )
            raise AllProvidersFailedError(
                f"Gemini failed and AI_FALLBACK_ENABLED is False: {gemini_error}",
                provider="gemini",
            )

        call_start = time.time()
        try:
            target_func = getattr(self.openai, method_name)
            result = target_func(*args, **kwargs)
            latency = int((time.time() - call_start) * 1000)

            self._record_metric(
                provider="openai",
                operation=operation,
                status="fallback_success",
                latency_ms=latency,
            )
            logger.info(f"[{operation}] OpenAI fallback succeeded in {latency}ms.")
            return result

        except Exception as openai_err:
            total_latency = int((time.time() - start_time) * 1000)
            self._record_metric(
                provider="all",
                operation=operation,
                status="all_failed",
                latency_ms=total_latency,
                error_message=f"Gemini: {gemini_error} | OpenAI: {openai_err}",
            )
            logger.error(
                f"[{operation}] Both Gemini and OpenAI failed! Gemini: {gemini_error}. OpenAI: {openai_err}"
            )
            raise AllProvidersFailedError(
                f"Tous les services d'intelligence artificielle ont échoué pour l'opération '{operation}'. "
                f"Veuillez réessayer plus tard.",
                provider="all",
                details={
                    "gemini_error": str(gemini_error),
                    "openai_error": str(openai_err),
                },
            ) from openai_err

    # -----------------------------------------------------------------
    # Public Abstracted Operations
    # -----------------------------------------------------------------

    def detect_language(self, text: str) -> LanguageDetectionResult:
        return self._execute_with_fallback("detect_language", "detect_language", text)

    def translate_text(
        self, text: str, target_lang: str, source_lang: Optional[str] = None
    ) -> TranslationResult:
        return self._execute_with_fallback(
            "translate_text", "translate_text", text, target_lang, source_lang
        )

    def analyze_sentiment(self, text: str) -> SentimentResult:
        return self._execute_with_fallback("analyze_sentiment", "analyze_sentiment", text)

    def moderate_content(
        self, text: str, context: Optional[dict[str, Any]] = None
    ) -> ModerationResult:
        return self._execute_with_fallback(
            "moderate_content", "moderate_content", text, context
        )

    def classify_community_policy_violation(
        self, text: str, community_rules: Optional[dict[str, Any]] = None
    ) -> PolicyViolationResult:
        return self._execute_with_fallback(
            "classify_community_policy_violation",
            "classify_community_policy_violation",
            text,
            community_rules,
        )

    def recommend_communities(
        self,
        interests: str,
        candidate_communities: list,
        language: str = "fr",
    ) -> CommunityRecommendationResult:
        return self._execute_with_fallback(
            "recommend_communities",
            "recommend_communities",
            interests,
            candidate_communities,
            language,
        )

    def plan_community(
        self,
        idea: str,
        language: str = "fr",
        context: Optional[dict[str, Any]] = None,
    ) -> CommunityProposalResult:
        return self._execute_with_fallback(
            "plan_community",
            "plan_community",
            idea,
            language,
            context,
        )

    def suggest_content(
        self,
        community_info: dict[str, Any],
        goal: Optional[str] = None,
        language: str = "fr",
    ) -> ContentSuggestionResult:
        return self._execute_with_fallback(
            "suggest_content",
            "suggest_content",
            community_info,
            goal,
            language,
        )

    def analyze_community(
        self,
        community_info: dict[str, Any],
        metrics: dict[str, Any],
        language: str = "fr",
    ) -> CommunityAnalysisResult:
        return self._execute_with_fallback(
            "analyze_community",
            "analyze_community",
            community_info,
            metrics,
            language,
        )

    def assistant_chat(
        self,
        message: str,
        history: list,
        context: Optional[dict[str, Any]] = None,
        language: str = "fr",
    ) -> AssistantChatResult:
        return self._execute_with_fallback(
            "assistant_chat",
            "assistant_chat",
            message,
            history,
            context,
            language,
        )


# Global singleton router instance
ai_router = ProviderRouter()

