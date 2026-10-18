import logging

from celery import shared_task

from apps.ai.services.sentiment_service import SentimentService
from apps.ai.services.translation_service import TranslationService

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=5)
def analyze_content_sentiment_task(
    self, text: str, community_id: str = None, entity_type: str = "", entity_id: str = ""
):
    """
    Asynchronous Celery background task for sentiment analysis
    so that message publishing is never blocked or slowed down.
    """
    try:
        from apps.communities.models.community import Community

        community = None
        if community_id:
            community = Community.objects.filter(id=community_id).first()

        SentimentService.analyze(
            text=text,
            community=community,
            entity_type=entity_type,
            entity_id=entity_id,
        )
    except Exception as exc:
        logger.warning(f"[analyze_content_sentiment_task] Error: {exc}")


@shared_task(bind=True, max_retries=2, default_retry_delay=5)
def precompute_translations_task(self, text: str, target_languages: list):
    """
    Optional background pre-computation of translations for popular community languages.
    """
    for lang in target_languages:
        try:
            TranslationService.translate(text, target_lang=lang)
        except Exception as e:
            logger.warning(f"[precompute_translations_task] Failed for {lang}: {e}")
