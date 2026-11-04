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


class AIProviderStrategy:
    AUTO = "auto"                     # Gemini first, fallback to OpenAI on failure/quota
    GEMINI_ONLY = "gemini_only"       # Strictly Gemini, no fallback
    OPENAI_ONLY = "openai_only"       # Strictly OpenAI, no fallback
    OPENAI_FIRST = "openai_first"     # OpenAI first, fallback to Gemini

    CHOICES = [
        (AUTO, "Automatique (Gemini prioritaire avec secours OpenAI)"),
        (GEMINI_ONLY, "Google Gemini uniquement (aucun basculement)"),
        (OPENAI_ONLY, "OpenAI uniquement (aucun basculement)"),
        (OPENAI_FIRST, "OpenAI prioritaire avec secours Gemini"),
    ]


class ProviderRouter:
    """
    Central AI Provider Router supporting dynamic provider selection,
    strict Gemini/OpenAI isolation, automatic failovers, circuit breaking, and observability.
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

    @classmethod
    def get_effective_strategy(cls, community=None) -> str:
        """
        Determines the effective provider strategy:
        1. Community-specific override (if configured).
        2. Dynamic SystemSetting in database/cache.
        3. Global Django setting AI_PROVIDER_STRATEGY / AI_PRIMARY_PROVIDER.
        """
        if community and hasattr(community, "settings"):
            override = getattr(community.settings, "ai_provider_override", "")
            if override == "gemini":
                return AIProviderStrategy.GEMINI_ONLY
            if override == "openai":
                return AIProviderStrategy.OPENAI_ONLY

        try:
            from django.core.cache import cache
            cached_strategy = cache.get("kodinga_ai_provider_strategy")
            if cached_strategy:
                return cached_strategy
            from apps.administration.models.setting import SystemSetting
            setting = SystemSetting.objects.filter(key="ai_provider_strategy").first()
            if setting and isinstance(setting.value, dict) and "strategy" in setting.value:
                strategy = setting.value["strategy"]
                cache.set("kodinga_ai_provider_strategy", strategy, timeout=300)
                return strategy
        except Exception:
            pass

        return getattr(settings, "AI_PROVIDER_STRATEGY", AIProviderStrategy.AUTO)

    @classmethod
    def set_global_strategy(cls, strategy: str, updated_by=None) -> None:
        """Dynamically persists the platform-wide strategy in SystemSetting and cache."""
        from django.core.cache import cache

        from apps.administration.models.setting import SystemSetting

        valid_strategies = [
            AIProviderStrategy.AUTO,
            AIProviderStrategy.GEMINI_ONLY,
            AIProviderStrategy.OPENAI_ONLY,
            AIProviderStrategy.OPENAI_FIRST,
        ]
        if strategy not in valid_strategies:
            raise ValueError(f"Stratégie invalide '{strategy}'. Valeurs possibles: {valid_strategies}")

        SystemSetting.objects.update_or_create(
            key="ai_provider_strategy",
            defaults={
                "value": {"strategy": strategy},
                "description": "Stratégie active de routage des providers IA",
                "updated_by": updated_by,
            },
        )
        cache.set("kodinga_ai_provider_strategy", strategy, timeout=300)

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
            pass

    def _execute_gemini_attempt(self, operation: str, method_name: str, *args, **kwargs):
        call_start = time.time()
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

    def _execute_openai_attempt(self, operation: str, method_name: str, *args, **kwargs):
        call_start = time.time()
        target_func = getattr(self.openai, method_name)
        result = target_func(*args, **kwargs)
        latency = int((time.time() - call_start) * 1000)

        self._record_metric(
            provider="openai",
            operation=operation,
            status="success",
            latency_ms=latency,
        )
        return result

    def _execute_with_fallback(self, operation: str, method_name: str, *args, **kwargs) -> Any:
        start_time = time.time()
        community = kwargs.pop("community", None)
        strategy = kwargs.pop("strategy", None) or self.get_effective_strategy(community=community)

        gemini_error = None
        openai_error = None

        # =============================================================
        # MODE 1: GEMINI ONLY
        # =============================================================
        if strategy == AIProviderStrategy.GEMINI_ONLY:
            if not self.circuit_breaker.can_attempt():
                raise AllProvidersFailedError(
                    "Gemini est configuré comme unique provider mais son quota est temporairement épuisé.",
                    provider="gemini",
                )
            try:
                return self._execute_gemini_attempt(operation, method_name, *args, **kwargs)
            except SafetyRejectionError as e:
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
            except Exception as e:
                total_latency = int((time.time() - start_time) * 1000)
                self._record_metric(
                    provider="gemini",
                    operation=operation,
                    status="failed_gemini_only",
                    latency_ms=total_latency,
                    error_message=str(e),
                )
                raise AllProvidersFailedError(
                    f"Le service Gemini a échoué pour l'opération '{operation}' et aucun basculement n'est autorisé: {e}",
                    provider="gemini",
                ) from e

        # =============================================================
        # MODE 2: OPENAI ONLY
        # =============================================================
        if strategy == AIProviderStrategy.OPENAI_ONLY:
            try:
                return self._execute_openai_attempt(operation, method_name, *args, **kwargs)
            except Exception as e:
                total_latency = int((time.time() - start_time) * 1000)
                self._record_metric(
                    provider="openai",
                    operation=operation,
                    status="failed_openai_only",
                    latency_ms=total_latency,
                    error_message=str(e),
                )
                raise AllProvidersFailedError(
                    f"Le service OpenAI a échoué pour l'opération '{operation}' et aucun basculement n'est autorisé: {e}",
                    provider="openai",
                ) from e

        # =============================================================
        # MODE 3: OPENAI FIRST (fallback Gemini)
        # =============================================================
        if strategy == AIProviderStrategy.OPENAI_FIRST:
            try:
                return self._execute_openai_attempt(operation, method_name, *args, **kwargs)
            except Exception as e:
                openai_error = e
                logger.warning(f"[{operation}] OpenAI principal a échoué ({e}). Basculement vers Gemini...")

            if self.fallback_enabled and self.circuit_breaker.can_attempt():
                try:
                    res = self._execute_gemini_attempt(operation, method_name, *args, **kwargs)
                    logger.info(f"[{operation}] Secours Gemini réussi.")
                    return res
                except Exception as e:
                    gemini_error = e

            total_latency = int((time.time() - start_time) * 1000)
            self._record_metric(
                provider="all",
                operation=operation,
                status="all_failed",
                latency_ms=total_latency,
                error_message=f"OpenAI: {openai_error} | Gemini: {gemini_error}",
            )
            raise AllProvidersFailedError(
                f"Tous les services d'intelligence artificielle ont échoué pour l'opération '{operation}'.",
                provider="all",
                details={"openai_error": str(openai_error), "gemini_error": str(gemini_error)},
            )

        # =============================================================
        # MODE 4: AUTO (GEMINI FIRST, fallback OpenAI) - DÉFAUT
        # =============================================================
        attempt_gemini = self.circuit_breaker.can_attempt()
        if attempt_gemini:
            retry_count = 0
            while retry_count <= self.max_retries:
                try:
                    return self._execute_gemini_attempt(operation, method_name, *args, **kwargs)
                except SafetyRejectionError as e:
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
                    gemini_error = e
                    self.circuit_breaker.record_quota_exhausted(str(e))
                    logger.warning(f"[{operation}] Gemini quota exhausted. Circuit breaker opened. Switching to fallback.")
                    break
                except ConfigurationError as e:
                    gemini_error = e
                    logger.critical(f"[{operation}] Gemini configuration error. Switching to fallback: {e}")
                    break
                except (RateLimitError, RecoverableProviderError) as e:
                    gemini_error = e
                    retry_count += 1
                    if retry_count <= self.max_retries:
                        time.sleep(0.3 * retry_count)
                    else:
                        self.circuit_breaker.record_transient_error(str(e))
                        logger.warning(f"[{operation}] Gemini failed after retries. Switching to fallback.")
                except Exception as e:
                    gemini_error = e
                    self.circuit_breaker.record_transient_error(str(e))
                    logger.warning(f"[{operation}] Gemini unexpected error ({e}). Switching to fallback.")
                    break
        else:
            logger.info(f"[{operation}] Gemini quota circuit breaker is OPEN. Directly routing to OpenAI fallback.")
            gemini_error = QuotaExhaustedError("Gemini circuit breaker is OPEN (quota exhausted)")

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
                f"Gemini a échoué et AI_FALLBACK_ENABLED est désactivé: {gemini_error}",
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
            logger.error(f"[{operation}] Both Gemini and OpenAI failed! Gemini: {gemini_error}. OpenAI: {openai_err}")
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

    def detect_language(self, text: str, **kwargs) -> LanguageDetectionResult:
        return self._execute_with_fallback("detect_language", "detect_language", text, **kwargs)

    def translate_text(
        self, text: str, target_lang: str, source_lang: Optional[str] = None, **kwargs
    ) -> TranslationResult:
        return self._execute_with_fallback(
            "translate_text", "translate_text", text, target_lang, source_lang, **kwargs
        )

    def analyze_sentiment(self, text: str, **kwargs) -> SentimentResult:
        return self._execute_with_fallback("analyze_sentiment", "analyze_sentiment", text, **kwargs)

    def moderate_content(
        self, text: str, context: Optional[dict[str, Any]] = None, **kwargs
    ) -> ModerationResult:
        return self._execute_with_fallback(
            "moderate_content", "moderate_content", text, context, **kwargs
        )

    def classify_community_policy_violation(
        self, text: str, community_rules: Optional[dict[str, Any]] = None, **kwargs
    ) -> PolicyViolationResult:
        return self._execute_with_fallback(
            "classify_community_policy_violation",
            "classify_community_policy_violation",
            text,
            community_rules,
            **kwargs,
        )

    def recommend_communities(
        self,
        interests: str,
        candidate_communities: list,
        language: str = "fr",
        **kwargs,
    ) -> CommunityRecommendationResult:
        return self._execute_with_fallback(
            "recommend_communities",
            "recommend_communities",
            interests,
            candidate_communities,
            language,
            **kwargs,
        )

    def plan_community(
        self,
        idea: str,
        language: str = "fr",
        context: Optional[dict[str, Any]] = None,
        **kwargs,
    ) -> CommunityProposalResult:
        return self._execute_with_fallback(
            "plan_community",
            "plan_community",
            idea,
            language,
            context,
            **kwargs,
        )

    def suggest_content(
        self,
        community_info: dict[str, Any],
        goal: Optional[str] = None,
        language: str = "fr",
        **kwargs,
    ) -> ContentSuggestionResult:
        return self._execute_with_fallback(
            "suggest_content",
            "suggest_content",
            community_info,
            goal,
            language,
            **kwargs,
        )

    def analyze_community(
        self,
        community_info: dict[str, Any],
        metrics: dict[str, Any],
        language: str = "fr",
        **kwargs,
    ) -> CommunityAnalysisResult:
        return self._execute_with_fallback(
            "analyze_community",
            "analyze_community",
            community_info,
            metrics,
            language,
            **kwargs,
        )

    def assistant_chat(
        self,
        message: str,
        history: list,
        context: Optional[dict[str, Any]] = None,
        language: str = "fr",
        **kwargs,
    ) -> AssistantChatResult:
        return self._execute_with_fallback(
            "assistant_chat",
            "assistant_chat",
            message,
            history,
            context,
            language,
            **kwargs,
        )



    def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        **kwargs,
    ) -> str:
        return self._execute_with_fallback("_generate", "_generate", prompt, system_instruction, **kwargs)

    def generate_embedding(self, text: str, **kwargs) -> list[float]:
        return self._execute_with_fallback("generate_embedding", "generate_embedding", text, **kwargs)


# Global singleton router instance
ai_router = ProviderRouter()
