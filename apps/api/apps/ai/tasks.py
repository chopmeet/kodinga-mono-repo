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


@shared_task(bind=True, max_retries=2, default_retry_delay=5)
def index_content_embedding_task(
    self,
    content_type: str,
    object_id: str,
    community_id: str,
    title: str,
    text: str,
    metadata: dict = None,
):
    """
    Asynchronous background indexing of content embeddings so creating
    posts or lessons is completely instantaneous.
    """
    try:
        from apps.ai.services.semantic_search_service import SemanticSearchService
        from apps.communities.models.community import Community

        community = Community.objects.filter(id=community_id).first()
        if community:
            SemanticSearchService.index_content(
                content_type=content_type,
                object_id=object_id,
                community=community,
                title=title,
                text=text,
                metadata=metadata,
            )
    except Exception as exc:
        logger.warning(f"[index_content_embedding_task] Failed for {content_type} {object_id}: {exc}")


@shared_task(bind=True, max_retries=2, default_retry_delay=10)
def generate_community_weekly_digest_task(
    self,
    community_id: str,
    week_identifier: str = None,
    force_refresh: bool = False,
):
    """
    Background generation of weekly community pulse digests.
    """
    try:
        from apps.ai.services.digest_service import CommunityDigestService
        from apps.communities.models.community import Community

        community = Community.objects.filter(id=community_id).first()
        if community:
            CommunityDigestService.generate_weekly_digest(
                community=community,
                week_identifier=week_identifier,
                force_refresh=force_refresh,
            )
    except Exception as exc:
        logger.warning(f"[generate_community_weekly_digest_task] Failed for community {community_id}: {exc}")


@shared_task(bind=True, max_retries=2, default_retry_delay=10)
def evaluate_community_churn_task(self, community_id: str):
    """
    Periodic background churn risk evaluation across community members.
    """
    try:
        from apps.ai.services.churn_service import ChurnPredictionService
        from apps.communities.models.community import Community

        community = Community.objects.filter(id=community_id).first()
        if community:
            ChurnPredictionService.evaluate_community_churn(community=community)
    except Exception as exc:
        logger.warning(f"[evaluate_community_churn_task] Failed for community {community_id}: {exc}")


@shared_task(bind=True, max_retries=2, default_retry_delay=10)
def send_smart_nudge_task(self, churn_risk_id: str, custom_message: str = None):
    """
    Background dispatch of creator smart re-engagement nudges.
    """
    try:
        from apps.ai.services.churn_service import ChurnPredictionService

        ChurnPredictionService.send_smart_nudge(
            churn_risk_id=churn_risk_id,
            custom_message=custom_message,
        )
    except Exception as exc:
        logger.warning(f"[send_smart_nudge_task] Failed for churn risk {churn_risk_id}: {exc}")


@shared_task(bind=True, max_retries=1)
def generate_all_communities_weekly_digest_periodic_task(self):
    """
    Scheduled task (weekly via Celery Beat) triggering weekly digests
    for all active communities.
    """
    from apps.communities.models.community import Community

    active_community_ids = list(
        Community.objects.filter(is_active=True).values_list("id", flat=True)
    )
    for cid in active_community_ids:
        try:
            generate_community_weekly_digest_task.delay(str(cid))
        except Exception as exc:
            logger.warning(f"[generate_all_communities_weekly_digest_periodic_task] Error dispatching for {cid}: {exc}")


@shared_task(bind=True, max_retries=1)
def evaluate_all_communities_churn_periodic_task(self):
    """
    Scheduled task (daily via Celery Beat) evaluating retention/churn risks
    across all active communities.
    """
    from apps.communities.models.community import Community

    active_community_ids = list(
        Community.objects.filter(is_active=True).values_list("id", flat=True)
    )
    for cid in active_community_ids:
        try:
            evaluate_community_churn_task.delay(str(cid))
        except Exception as exc:
            logger.warning(f"[evaluate_all_communities_churn_periodic_task] Error dispatching for {cid}: {exc}")

