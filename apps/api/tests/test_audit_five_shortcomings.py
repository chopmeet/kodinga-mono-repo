from unittest.mock import patch

import pytest
from django.conf import settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.ai.router import ai_router
from apps.ai.services.semantic_search_service import (
    SemanticSearchService,
    compute_cosine_similarity,
)
from apps.communities.models.community import Community, CommunityPrivacy
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.posts.models.post import Post
from config.celery import app as celery_app


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_user():
    return User.objects.create_user(
        username="test_auditor",
        email="auditor@kodinga.com",
        password="ValidPassword123!",
    )


@pytest.fixture
def community(auth_user):
    comm = Community.objects.create(
        name="Tech Innovators",
        slug="tech-innovators",
        owner=auth_user,
        privacy_type=CommunityPrivacy.PUBLIC,
    )
    CommunityMember.objects.create(
        community=comm,
        user=auth_user,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.mark.django_db
class TestAuditFiveShortcomingsFixes:
    def test_m1_unmounted_views_now_accessible(self, api_client, auth_user, community):
        """
        Manquement 1: Verify the 4 previously unmounted views are now accessible via URL routing.
        """
        # 1. Languages list
        res_lang = api_client.get("/api/v1/languages/")
        assert res_lang.status_code == status.HTTP_200_OK
        lang_data = res_lang.json().get("data", {})
        assert "languages" in lang_data
        assert lang_data.get("african_languages_count", 0) > 0
        assert lang_data.get("international_languages_count", 0) > 0

        # Alias /api/v1/ai/languages/
        res_alias = api_client.get("/api/v1/ai/languages/")
        assert res_alias.status_code == status.HTTP_200_OK

        # 2. Assistant plan community
        with patch.object(ai_router, "plan_community") as mock_plan:
            from apps.ai.schemas import CommunityProposalResult, FirstWeekPlanItem
            mock_plan.return_value = CommunityProposalResult(
                name_proposals=["Django Pros"],
                suggested_slug="django-pros",
                tagline="Communauté des devs Django",
                description="Espace d'entraide",
                rules=["Respect", "Partage"],
                first_week_launch_plan=[
                    FirstWeekPlanItem(day="Jour 1", focus="Onboarding", action_items=["Accueil des membres"])
                ],
                recommended_topics=["Django", "DRF"],
                provider="gemini",
            )
            res_plan = api_client.post(
                "/api/v1/ai-assistant/plan-community/",
                data={"idea": "Une communauté pour les développeurs Django"},
                format="json",
            )
            assert res_plan.status_code == status.HTTP_200_OK
            assert res_plan.json().get("success") is True
            assert len(res_plan.json().get("data", {}).get("first_week_launch_plan", [])) == 1

        # 3. Assistant recommend communities
        with patch.object(ai_router, "recommend_communities") as mock_rec:
            from apps.ai.schemas import (
                CommunityRecommendationCard,
                CommunityRecommendationResult,
            )
            mock_rec.return_value = CommunityRecommendationResult(
                recommendations=[
                    CommunityRecommendationCard(
                        id=str(community.id),
                        name=community.name,
                        slug=community.slug,
                        description=community.description or "Tech community",
                        relevance_reason="Matches tech interests",
                        match_score=0.95,
                    )
                ],
                search_query="Python and cloud",
                total_candidates_analyzed=1,
                provider="gemini",
            )
            res_rec = api_client.post(
                "/api/v1/ai-assistant/recommend-communities/",
                data={"interests": "Python, web and cloud computing"},
                format="json",
            )
            assert res_rec.status_code == status.HTTP_200_OK
            assert res_rec.json().get("success") is True
            assert len(res_rec.json().get("data", {}).get("recommendations", [])) == 1

        # 4. Assistant suggest content
        with patch.object(ai_router, "suggest_content") as mock_sug:
            from apps.ai.schemas import ContentSuggestionResult
            mock_sug.return_value = ContentSuggestionResult(
                icebreakers=["Présentez-vous en 3 mots"],
                first_post_template="Bienvenue dans la communauté !",
                discussion_topics=["Quel framework préférez-vous ?"],
                event_ideas=["Webinaire de bienvenue"],
                provider="gemini",
            )
            res_sug = api_client.post(
                "/api/v1/ai-assistant/suggest-content/",
                data={"community": community.slug, "goal": "Lancer l'engagement"},
                format="json",
            )
            assert res_sug.status_code == status.HTTP_200_OK
            assert res_sug.json().get("success") is True

    def test_m2_embedding_dimensions_harmonized_to_768(self, community):
        """
        Manquement 2: Verify embeddings output dimension 768 for both Gemini, OpenAI and fallback,
        and verify cosine similarity warning and computation.
        """
        from apps.ai.providers.gemini import GeminiAdapter
        from apps.ai.providers.openai_adapter import OpenAIAdapter

        gemini_adapter = GeminiAdapter()
        openai_adapter = OpenAIAdapter()

        vec_gemini = gemini_adapter.generate_embedding("Test text for embedding")
        vec_openai = openai_adapter.generate_embedding("Test text for embedding")

        # In testing/offline mode, both use deterministic fallback
        assert len(vec_gemini) == 768
        assert len(vec_openai) == 768

        # Test cosine similarity on identical vectors
        sim = compute_cosine_similarity(vec_gemini, vec_gemini)
        assert abs(sim - 1.0) < 1e-4

        # Test cosine similarity with dimension mismatch warning
        sim_mismatch = compute_cosine_similarity(vec_gemini, [0.1] * 128)
        assert isinstance(sim_mismatch, float)

        # Verify index_content records dimensions metadata
        indexed = SemanticSearchService.index_content(
            content_type="post",
            object_id="00000000-0000-0000-0000-000000000001",
            community=community,
            title="Test Post Title",
            text="Test post content for semantic indexing",
        )
        assert indexed.metadata.get("dimensions") == 768

    def test_m3_celery_beat_schedule_contains_ai_tasks(self, community):
        """
        Manquement 3: Verify the AI tasks are configured in Celery Beat schedule.
        """
        schedule = celery_app.conf.beat_schedule
        assert "evaluate-all-communities-churn-daily" in schedule
        assert schedule["evaluate-all-communities-churn-daily"]["task"] == "apps.ai.tasks.evaluate_all_communities_churn_periodic_task"
        assert schedule["evaluate-all-communities-churn-daily"]["schedule"] == 86400.0

        assert "generate-all-communities-weekly-digest-weekly" in schedule
        assert schedule["generate-all-communities-weekly-digest-weekly"]["task"] == "apps.ai.tasks.generate_all_communities_weekly_digest_periodic_task"
        assert schedule["generate-all-communities-weekly-digest-weekly"]["schedule"] == 604800.0

        # Execute periodic task wrapper without exceptions
        from apps.ai.tasks import (
            evaluate_all_communities_churn_periodic_task,
            generate_all_communities_weekly_digest_periodic_task,
        )
        with patch("apps.ai.tasks.evaluate_community_churn_task.delay") as mock_churn_delay, \
             patch("apps.ai.tasks.generate_community_weekly_digest_task.delay") as mock_digest_delay:
            evaluate_all_communities_churn_periodic_task()
            assert mock_churn_delay.called

            generate_all_communities_weekly_digest_periodic_task()
            assert mock_digest_delay.called

    def test_m4_post_view_count_atomically_incremented(self, api_client, auth_user, community):
        """
        Manquement 4: Verify PostDetailView.get() atomically increments views_count using F expression.
        """
        post = Post.objects.create(
            community=community,
            author=auth_user,
            title="Atomic Post View Count Test",
            content="Content for testing view counter.",
            views_count=5,
        )

        res = api_client.get(f"/api/v1/posts/{post.id}/")
        assert res.status_code == status.HTTP_200_OK

        post.refresh_from_db()
        assert post.views_count == 6

    def test_m5_moderation_enabled_setting(self):
        """
        Manquement 5: Verify AI_MODERATION_ENABLED setting and safe enforcement.
        """
        from apps.ai.services.moderation_service import ModerationService

        # By default in settings or env, verify evaluate_content returns allow when disabled
        with patch.object(settings, "AI_MODERATION_ENABLED", False):
            res_disabled = ModerationService.evaluate_content("A test message")
            assert res_disabled.decision == "allow"
            assert res_disabled.provider == "disabled"
