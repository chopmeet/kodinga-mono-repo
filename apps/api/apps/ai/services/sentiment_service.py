import hashlib
import logging
from typing import Optional

from apps.ai.models.sentiment import SentimentRecord
from apps.ai.router import ai_router
from apps.ai.schemas import SentimentResult
from apps.communities.models.community import Community

logger = logging.getLogger(__name__)


class SentimentService:
    """
    Sentiment classification service (Positive, Neutral, Negative, Mixed, Uncertain).
    Powers community analytics and engagement summaries.
    NOTE: Negative sentiment alone never triggers a ban or removal of legitimate criticism.
    """

    @classmethod
    def analyze(
        cls,
        text: str,
        community: Optional[Community] = None,
        entity_type: str = "",
        entity_id: str = "",
    ) -> SentimentResult:
        clean = (text or "").strip()
        if not clean:
            return SentimentResult(
                sentiment="neutral",
                score=0.0,
                confidence=1.0,
                reason="Empty text",
                provider="default",
            )

        content_hash = hashlib.sha256(clean.encode("utf-8")).hexdigest()

        try:
            result = ai_router.analyze_sentiment(clean)

            # Persist record for analytics
            try:
                SentimentRecord.objects.create(
                    content_hash=content_hash,
                    community=community,
                    sentiment=result.sentiment,
                    score=result.score,
                    confidence=result.confidence,
                    reason=result.reason,
                    provider=result.provider,
                    entity_type=entity_type,
                    entity_id=entity_id,
                )
            except Exception as db_err:
                logger.warning(f"[SentimentService] DB save failed: {db_err}")

            return result

        except Exception as e:
            logger.warning(f"[SentimentService] Sentiment analysis failed: {e}")
            return SentimentResult(
                sentiment="uncertain",
                score=0.0,
                confidence=0.5,
                reason=f"Provider error: {e}",
                provider="fallback",
            )
