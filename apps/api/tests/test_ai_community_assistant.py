from unittest.mock import patch

import pytest
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.ai.models import AssistantConversation, AssistantMessage
from apps.ai.providers.exceptions import (
    AllProvidersFailedError,
    QuotaExhaustedError,
)
from apps.ai.schemas import (
    AssistantChatResult,
    CommunityAnalysisResult,
    CommunityProposalResult,
    CommunityRecommendationCard,
    CommunityRecommendationResult,
    ContentSuggestionResult,
    FirstWeekPlanItem,
    ImprovementRecommendation,
    ModerationResult,
)
from apps.ai.services.assistant_service import AIAssistantService
from apps.communities.models.category import CommunityCategory
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.communities.models.settings import CommunitySettings
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.posts.models.category import PostCategory
from apps.posts.models.post import Post, PostType


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def owner(db):
    return User.objects.create_user(
        email="owner_assist@kodinga.com",
        username="owner_assist",
        password="SecurePassword123!",
    )


@pytest.fixture
def member(db):
    return User.objects.create_user(
        email="member_assist@kodinga.com",
        username="member_assist",
        password="SecurePassword123!",
    )


@pytest.fixture
def stranger(db):
    return User.objects.create_user(
        email="stranger_assist@kodinga.com",
        username="stranger_assist",
        password="SecurePassword123!",
    )


@pytest.fixture
def tech_category(db):
    return CommunityCategory.objects.create(
        name="Intelligence Artificielle & Data",
        slug="ia-data",
    )


@pytest.fixture
def public_community(owner, member, tech_category):
    comm = Community.objects.create(
        owner=owner,
        name="Python & IA Dakar",
        slug="python-ia-dakar",
        tagline="Communauté des développeurs Python et Data Science",
        description="Le hub d'apprentissage et de partage pour les développeurs Python au Sénégal.",
        category=tech_category,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.FREE,
        members_count=42,
        posts_count=15,
    )
    CommunitySettings.objects.create(
        community=comm,
        default_community_language="fr",
    )
    CommunityMember.objects.create(
        community=comm,
        user=owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=member,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    PostCategory.objects.create(
        community=comm,
        name="Général",
        slug="general",
    )
    PostCategory.objects.create(
        community=comm,
        name="Showcase Projets",
        slug="showcase",
    )
    return comm


@pytest.fixture
def secret_community(owner):
    comm = Community.objects.create(
        owner=owner,
        name="Club Privé Exclusif",
        slug="club-prive-exclusif",
        tagline="Cercle fermé de dirigeants",
        description="Accès confidentiel réservé aux membres invités.",
        privacy_type=CommunityPrivacy.SECRET,
        members_count=3,
    )
    CommunityMember.objects.create(
        community=comm,
        user=owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.fixture(autouse=True)
def mock_moderation_clean():
    """Ensure clean text moderation passes in assistant tests unless testing safety."""
    with patch("apps.ai.router.ai_router.moderate_content") as mock_mod:
        mock_mod.return_value = ModerationResult(
            decision="allow",
            flagged=False,
            categories=[],
            confidence=0.99,
            provider="mock_moderation",
        )
        yield mock_mod


# ==============================================================================
# 1. PERSONALIZED COMMUNITY RECOMMENDATIONS (GROUNDED)
# ==============================================================================


@pytest.mark.django_db
class TestPersonalizedCommunityRecommendations:
    def test_recommends_real_relevant_communities_from_database(
        self, stranger, public_community
    ):
        """1. Recommends real communities from database with personalized relevance explanations."""
        with patch("apps.ai.router.ai_router.recommend_communities") as mock_rec:
            mock_rec.return_value = CommunityRecommendationResult(
                recommendations=[
                    CommunityRecommendationCard(
                        id=str(public_community.id),
                        name="Python & IA Dakar",
                        slug="python-ia-dakar",
                        tagline=public_community.tagline,
                        description=public_community.description,
                        category="Intelligence Artificielle & Data",
                        privacy_type="public",
                        pricing_type="free",
                        members_count=42,
                        language="fr",
                        relevance_reason="Idéal pour apprendre Python et développer des modèles d'IA en groupe.",
                        match_score=0.98,
                    )
                ],
                reasoning="Excellente correspondance avec vos compétences Python.",
                suggested_alternatives=[],
                provider="gemini",
            )

            result = AIAssistantService.recommend_communities(
                interests="Je veux apprendre Python et l'intelligence artificielle",
                user=stranger,
            )

            assert len(result.recommendations) == 1
            card = result.recommendations[0]
            assert card.id == str(public_community.id)
            assert card.slug == "python-ia-dakar"
            assert card.name == "Python & IA Dakar"
            assert "Idéal pour apprendre" in card.relevance_reason

    def test_recommendations_respect_privacy_and_secret_communities(
        self, stranger, public_community, secret_community
    ):
        """2. Secret communities are strictly excluded from candidates for non-members."""
        with patch("apps.ai.router.ai_router.recommend_communities") as mock_rec:
            mock_rec.return_value = CommunityRecommendationResult(
                recommendations=[],
                reasoning="Recherche effectuée",
                suggested_alternatives=[],
                provider="gemini",
            )

            AIAssistantService.recommend_communities(
                interests="Club privé ou cercle d'affaires",
                user=stranger,
            )

            # Check the candidate communities passed to AI
            args, kwargs = mock_rec.call_args
            candidates = kwargs.get("candidate_communities") or args[1]
            candidate_ids = [c["id"] for c in candidates]

            # Secret community must NOT be in the candidates!
            assert str(secret_community.id) not in candidate_ids
            # Public community is included
            assert str(public_community.id) in candidate_ids

    def test_grounding_rejects_hallucinated_communities(
        self, stranger, public_community
    ):
        """3. Discards hallucinated or non-existent communities not present in database."""
        with patch("apps.ai.router.ai_router.recommend_communities") as mock_rec:
            # Model hallucinated a fake community
            mock_rec.return_value = CommunityRecommendationResult(
                recommendations=[
                    CommunityRecommendationCard(
                        id="fake-id-12345",
                        name="Invented Tech Club",
                        slug="invented-tech-club",
                        tagline="Does not exist in DB",
                        description="Fake description",
                        category="General",
                        privacy_type="public",
                        pricing_type="free",
                        members_count=1000,
                        language="fr",
                        relevance_reason="Fake reason",
                        match_score=0.99,
                    )
                ],
                reasoning="Hallucination test",
                suggested_alternatives=[],
                provider="gemini",
            )

            result = AIAssistantService.recommend_communities(
                interests="Club robotique",
                user=stranger,
            )

            # Grounding verification filtered it out!
            assert len(result.recommendations) == 0


# ==============================================================================
# 2. COMMUNITY CREATION WIZARD (PROPOSAL GENERATOR)
# ==============================================================================


@pytest.mark.django_db
class TestCommunityCreationWizard:
    def test_user_describes_idea_receives_structured_proposal(self, stranger):
        """4. Transforms user's natural language concept into structured proposal."""
        with patch("apps.ai.router.ai_router.plan_community") as mock_plan:
            mock_plan.return_value = CommunityProposalResult(
                name_suggestions=[
                    "AfroAI Hub",
                    "Senegal Machine Learning",
                    "Kodinga AI Pioneers",
                ],
                description="Réseau d'ingénieurs et entrepreneurs IA en Afrique de l'Ouest.",
                purpose="Démocratiser l'apprentissage et l'application concrète de l'IA en Afrique.",
                target_audience="Développeurs, data scientists, et fondateurs tech",
                suggested_categories=[
                    "#general",
                    "#modeles-llm",
                    "#offres-emploi",
                    "#projets",
                ],
                suggested_rules=[
                    "Bienveillance et respect",
                    "Partage constructif sans spam",
                ],
                recommended_language="fr",
                recommended_visibility="public",
                welcome_message="Bienvenue sur AfroAI Hub ! Présentez votre parcours et votre projet actuel.",
                first_discussion_prompts=[
                    "Quel est le premier cas d'usage IA que vous souhaitez résoudre ?",
                    "Partagez votre outil d'IA préféré du moment !",
                    "Quel framework utilisez-vous : PyTorch, TensorFlow ou Scikit-learn ?",
                ],
                initial_event_ideas=[
                    "Atelier live : Déployer un LLM localement",
                    "AMA avec un chercheur IA",
                ],
                first_week_launch_plan=[
                    FirstWeekPlanItem(
                        day="Jour 1",
                        focus="Lancement & Accueil",
                        action_items=[
                            "Publier le message de bienvenue",
                            "Inviter 10 premiers pionniers",
                        ],
                    )
                ],
                follow_up_questions=[],
                provider="gemini",
            )

            proposal = AIAssistantService.plan_community(
                idea="Je veux lancer une communauté pour les passionnés d'IA en Afrique francophone",
                user=stranger,
            )

            assert len(proposal.name_suggestions) == 3
            assert "AfroAI Hub" in proposal.name_suggestions
            assert len(proposal.first_discussion_prompts) >= 3
            assert proposal.recommended_visibility == "public"
            assert len(proposal.first_week_launch_plan) >= 1

    def test_proposal_does_not_create_records_without_user_confirmation(self, stranger):
        """5. NEVER creates or publishes community or content without explicit confirmation."""
        initial_community_count = Community.objects.count()
        initial_post_count = Post.objects.count()

        with patch("apps.ai.router.ai_router.plan_community") as mock_plan:
            mock_plan.return_value = CommunityProposalResult(
                name_suggestions=["Cloud Native Africa"],
                description="DevOps et Cloud",
                purpose="Partager l'expertise Kubernetes et Cloud",
                target_audience="DevOps",
                suggested_categories=["#devops"],
                suggested_rules=["Pas de spam"],
                recommended_language="fr",
                recommended_visibility="public",
                welcome_message="Bienvenue !",
                first_discussion_prompts=["Prompt 1", "Prompt 2", "Prompt 3"],
                initial_event_ideas=["Workshop"],
                first_week_launch_plan=[],
                follow_up_questions=[],
                provider="gemini",
            )

            AIAssistantService.plan_community(
                idea="Communauté DevOps pour conteneurs",
                user=stranger,
            )

            # Database records MUST remain unchanged
            assert Community.objects.count() == initial_community_count
            assert Post.objects.count() == initial_post_count


# ==============================================================================
# 3. CONTENT & ACTIVITY SUGGESTIONS
# ==============================================================================


@pytest.mark.django_db
class TestContentAndActivitySuggestions:
    def test_content_suggestions_tailored_to_community(self, public_community, owner):
        """6. Suggests discussion channels, first post draft, and weekly activities."""
        with patch("apps.ai.router.ai_router.suggest_content") as mock_sug:
            mock_sug.return_value = ContentSuggestionResult(
                discussion_categories=["#projets", "#entraide-python", "#annonces"],
                first_post={
                    "title": "Bienvenue sur Python & IA Dakar !",
                    "content": "Présentez-vous en quelques lignes et dites-nous ce que vous construisez en ce moment.",
                    "type": "discussion",
                },
                weekly_activities=[
                    {
                        "title": "Code Review Mercredi",
                        "description": "Partagez votre fonction ou notebook pour retours",
                    }
                ],
                monthly_events=[
                    {
                        "title": "Webinaire IA Générative",
                        "format": "online",
                        "description": "Session démo live",
                    }
                ],
                onboarding_prompt="Bienvenue parmi nous !",
                weekly_content_calendar=[
                    {
                        "day": "Lundi",
                        "topic": "Présentation des nouveaux",
                        "type": "discussion",
                    }
                ],
                provider="gemini",
            )

            res = AIAssistantService.suggest_content(
                community_identifier=public_community.slug,
                user=owner,
            )

            assert len(res.discussion_categories) == 3
            assert res.first_post["title"] == "Bienvenue sur Python & IA Dakar !"
            assert len(res.weekly_activities) == 1
            # Does not write post to database
            assert (
                Post.objects.filter(title="Bienvenue sur Python & IA Dakar !").count()
                == 0
            )


# ==============================================================================
# 4. COMMUNITY IMPROVEMENT & HEALTH ANALYSIS
# ==============================================================================


@pytest.mark.django_db
class TestCommunityImprovementAnalysis:
    def test_analysis_uses_real_metrics_and_data(self, public_community, owner):
        """7. Community improvement uses real database metrics (posts, events, members)."""
        # Create a real post and event
        Post.objects.create(
            community=public_community,
            author=owner,
            title="Question sur PyTorch",
            content="Comment configurer le GPU ?",
            post_type=PostType.QUESTION,
            comments_count=0,
        )

        with patch("apps.ai.router.ai_router.analyze_community") as mock_ana:
            mock_ana.return_value = CommunityAnalysisResult(
                community_name=public_community.name,
                overview_assessment="Communauté jeune avec une bonne base de membres mais peu d'événements programmés.",
                strengths=[
                    "Thématique porteuse et attractive",
                    "Membres fondateurs actifs",
                ],
                improvement_areas=[
                    "Absence d'événements à venir",
                    "Questions restées sans réponse",
                ],
                actionable_recommendations=[
                    ImprovementRecommendation(
                        category="events",
                        title="Organiser un premier webinaire de bienvenue",
                        action_draft="Session live de 45 minutes : Présentation de la roadmap et Q&A",
                        rationale="Active l'engagement et crée du lien direct.",
                    )
                ],
                event_suggestions=["Live Coding PyTorch", "Atelier Pandas"],
                engagement_tactics=["Relancer les questions sans réponse le vendredi"],
                metrics_summary={},
                provider="gemini",
            )

            res = AIAssistantService.analyze_community(
                community_identifier=public_community.slug,
                user=owner,
            )

            assert res.community_name == "Python & IA Dakar"
            assert len(res.actionable_recommendations) == 1
            assert res.metrics_summary["members_count"] == 42
            assert res.metrics_summary["unanswered_questions_count"] == 1

    def test_unauthorized_user_cannot_analyze_community(
        self, public_community, stranger
    ):
        """8. Permission check: strangers cannot access owner/moderator analytics."""
        with pytest.raises(PermissionDenied) as exc_info:
            AIAssistantService.analyze_community(
                community_identifier=public_community.slug,
                user=stranger,
            )
        assert "administrateur ou modérateur" in str(exc_info.value)


# ==============================================================================
# 5. AI PROVIDER FALLBACK & SAFETY ENFORCEMENT
# ==============================================================================


@pytest.mark.django_db
class TestAssistantProviderRoutingAndSafety:
    def test_gemini_primary_used_openai_fallback_on_quota_exhausted(self, stranger):
        with (
            patch("apps.ai.router.ai_router.gemini.assistant_chat") as mock_gemini,
            patch("apps.ai.router.ai_router.openai.assistant_chat") as mock_openai,
        ):
            # Gemini throws QuotaExhaustedError
            mock_gemini.side_effect = QuotaExhaustedError(
                "Resource exhausted: 429 quota"
            )
            # OpenAI fallback returns response
            mock_openai.return_value = AssistantChatResult(
                reply="Bonjour, voici comment je peux vous orienter.",
                suggested_follow_ups=["Quels sont vos langages favoris ?"],
                provider="openai",
            )

            reply = AIAssistantService.chat(
                message="Bonjour, peux-tu m'aider ?",
                user=stranger,
            )

            assert reply["provider"] == "openai"
            assert "voici comment" in reply["reply"]
            assert mock_gemini.call_count == 1
            assert mock_openai.call_count == 1

    def test_both_providers_fail_returns_handled_service_error(
        self, stranger, api_client
    ):
        """10. Fail-closed / controlled error when both providers fail."""
        api_client.force_authenticate(user=stranger)
        with patch("apps.ai.router.ai_router.assistant_chat") as mock_chat:
            mock_chat.side_effect = AllProvidersFailedError("All providers unavailable")

            res = api_client.post(
                "/api/v1/ai-assistant/chat/",
                {"message": "Hello"},
                format="json",
            )

            assert res.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
            assert "temporairement indisponible" in res.data["error"]

    def test_assistant_blocks_sexual_harassment_and_prohibited_content(self, stranger):
        """11. Mandatory platform safety rules block abusive or harassing input."""
        with patch(
            "apps.ai.services.moderation_service.ModerationService.evaluate_content"
        ) as mock_eval:
            mock_eval.return_value = ModerationResult(
                decision="reject",
                flagged=True,
                categories=["sexual_harassment"],
                confidence=0.99,
                reason="Harcèlement sexuel interdit",
                provider="gemini",
            )

            with pytest.raises(PermissionDenied) as exc_info:
                AIAssistantService.chat(
                    message="Contenu de harcèlement sexuel interdit",
                    user=stranger,
                )
            assert "sécurité de la plateforme" in str(exc_info.value)

    def test_multilingual_language_support_french_wolof_bambara_english(self, stranger):
        """12. Respects user requested language (fr, en, wo, bm)."""
        with patch("apps.ai.router.ai_router.assistant_chat") as mock_chat:
            mock_chat.return_value = AssistantChatResult(
                reply="Na nga def ! Dalal ak jamm ci Kodinga.",
                suggested_follow_ups=["Naka laay dugge ci mbooloo mi ?"],
                provider="gemini",
            )

            reply = AIAssistantService.chat(
                message="Nanga def",
                user=stranger,
                language="wo",
            )

            assert "Dalal ak jamm" in reply["reply"]
            # Verify language 'wo' was forwarded to router
            assert mock_chat.call_args[1]["language"] == "wo"


@pytest.mark.django_db
class TestAIAssistantConversationSessionManagement:
    def test_chat_creates_new_session_and_preserves_history(self, stranger, api_client):
        """Conversational chat initiates a session and maintains message history across turns."""
        api_client.force_authenticate(user=stranger)

        with patch("apps.ai.router.ai_router.assistant_chat") as mock_chat:
            mock_chat.return_value = AssistantChatResult(
                reply="Bonjour ! Comment puis-je vous aider ?",
                suggested_follow_ups=["Créer une communauté", "Trouver des mentors"],
                provider="gemini",
            )

            # Turn 1: No conversation_id provided -> Creates a new session
            res1 = api_client.post(
                "/api/v1/ai-assistant/chat/",
                {"message": "Bonjour assistant"},
                format="json",
            )
            assert res1.status_code == status.HTTP_200_OK
            conv_id = res1.data["data"]["conversation_id"]
            assert conv_id is not None

            # Verify DB has 2 messages (user + assistant)
            conversation = AssistantConversation.objects.get(id=conv_id)
            assert conversation.user == stranger
            assert conversation.messages.count() == 2
            assert conversation.messages.filter(role="user").first().content == "Bonjour assistant"
            assert conversation.messages.filter(role="assistant").first().content == "Bonjour ! Comment puis-je vous aider ?"

            # Turn 2: Providing conversation_id -> Resumes existing session
            mock_chat.return_value = AssistantChatResult(
                reply="Pour créer une communauté, cliquez sur le bouton Créer.",
                suggested_follow_ups=["Définir les règles"],
                provider="gemini",
            )
            res2 = api_client.post(
                "/api/v1/ai-assistant/chat/",
                {
                    "message": "Je veux créer une communauté",
                    "conversation_id": conv_id,
                },
                format="json",
            )
            assert res2.status_code == status.HTTP_200_OK
            assert res2.data["data"]["conversation_id"] == conv_id

            conversation.refresh_from_db()
            assert conversation.messages.count() == 4

            # Verify history was forwarded to LLM router
            history_arg = mock_chat.call_args[1]["history"]
            assert len(history_arg) == 2  # Turn 1 user + Turn 1 assistant
            assert history_arg[0]["role"] == "user"
            assert history_arg[1]["role"] == "assistant"

    def test_conversation_list_and_detail_crud_apis(self, stranger, api_client):
        """API endpoints for listing, reading, renaming, clearing, and deleting conversations."""
        api_client.force_authenticate(user=stranger)

        # 1. Create session via POST /api/v1/ai-assistant/conversations/
        create_res = api_client.post(
            "/api/v1/ai-assistant/conversations/",
            {"title": "Discussion Architecture", "context_type": "creation"},
            format="json",
        )
        assert create_res.status_code == status.HTTP_201_CREATED
        conv_id = create_res.data["data"]["id"]

        # Add dummy messages
        conv = AssistantConversation.objects.get(id=conv_id)
        AssistantMessage.objects.create(conversation=conv, role="user", content="Comment scaler ?")
        AssistantMessage.objects.create(conversation=conv, role="assistant", content="Utilisez un load balancer.")

        # 2. List sessions via GET /api/v1/ai-assistant/conversations/
        list_res = api_client.get("/api/v1/ai-assistant/conversations/")
        assert list_res.status_code == status.HTTP_200_OK
        assert len(list_res.data["data"]) >= 1
        assert list_res.data["data"][0]["id"] == conv_id

        # 3. Retrieve conversation detail via GET /api/v1/ai-assistant/conversations/<id>/
        detail_res = api_client.get(f"/api/v1/ai-assistant/conversations/{conv_id}/")
        assert detail_res.status_code == status.HTTP_200_OK
        assert len(detail_res.data["data"]["messages"]) == 2

        # 4. Rename conversation via PATCH /api/v1/ai-assistant/conversations/<id>/
        patch_res = api_client.patch(
            f"/api/v1/ai-assistant/conversations/{conv_id}/",
            {"title": "Architecture Haute Disponibilité"},
            format="json",
        )
        assert patch_res.status_code == status.HTTP_200_OK
        assert patch_res.data["data"]["title"] == "Architecture Haute Disponibilité"

        # 5. Clear messages via POST /api/v1/ai-assistant/conversations/<id>/clear/
        clear_res = api_client.post(f"/api/v1/ai-assistant/conversations/{conv_id}/clear/")
        assert clear_res.status_code == status.HTTP_200_OK
        assert conv.messages.count() == 0

        # 6. Delete conversation via DELETE /api/v1/ai-assistant/conversations/<id>/
        delete_res = api_client.delete(f"/api/v1/ai-assistant/conversations/{conv_id}/")
        assert delete_res.status_code == status.HTTP_200_OK
        assert not AssistantConversation.objects.filter(id=conv_id).exists()

