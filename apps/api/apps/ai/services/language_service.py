import logging

from apps.ai.router import ai_router
from apps.ai.schemas import LanguageDetectionResult

logger = logging.getLogger(__name__)


class LanguageDetectionService:
    """
    Service for identifying the language of community messages and posts.
    Primary detection via Google Gemini, falling back to OpenAI.
    """

    @classmethod
    def detect(cls, text: str) -> LanguageDetectionResult:
        clean = (text or "").strip()
        if not clean or len(clean) < 3:
            return LanguageDetectionResult(
                language_code="fr",
                confidence=1.0,
                name="Français",
                provider="default",
            )

        try:
            return ai_router.detect_language(clean)
        except Exception as e:
            logger.warning(f"[LanguageDetectionService] Detection failed: {e}. Defaulting to 'fr'.")
            return LanguageDetectionResult(
                language_code="fr",
                confidence=0.5,
                name="Français",
                provider="fallback_default",
            )
