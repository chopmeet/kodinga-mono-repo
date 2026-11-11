import logging

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai.models.assistant import AssistantConversation
from apps.ai.providers.exceptions import AllProvidersFailedError
from apps.ai.serializers import (
    AnalyzeCommunityRequestSerializer,
    AssistantChatRequestSerializer,
    AssistantChatResponseSerializer,
    AssistantConversationSerializer,
    CommunityAnalysisResponseSerializer,
    CommunityProposalResponseSerializer,
    CommunityRecommendationResponseSerializer,
    ContentSuggestionResponseSerializer,
    CreateConversationRequestSerializer,
    PlanCommunityRequestSerializer,
    RecommendCommunitiesRequestSerializer,
    SuggestContentRequestSerializer,
    UpdateConversationRequestSerializer,
)
from apps.ai.services.assistant_service import AIAssistantService

logger = logging.getLogger(__name__)


class AIAssistantRecommendCommunitiesView(APIView):
    """
    POST /api/v1/ai-assistant/recommend-communities/
    Grounded discovery: returns real matching communities with explanations.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["AI & Assistant"],
        summary="Recommander des communautés existantes selon les centres d'intérêt",
        description="Recherche dans la base de données réelle et filtre selon les règles de confidentialité.",
        request=RecommendCommunitiesRequestSerializer,
        responses={200: CommunityRecommendationResponseSerializer},
    )
    def post(self, request, *args, **kwargs):
        serializer = RecommendCommunitiesRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user if request.user.is_authenticated else None
        interests = serializer.validated_data["interests"]
        language = serializer.validated_data.get("language")

        try:
            result = AIAssistantService.recommend_communities(
                interests=interests,
                user=user,
                language=language,
            )
            return Response(
                {
                    "success": True,
                    "data": result.model_dump(),
                },
                status=status.HTTP_200_OK,
            )
        except AllProvidersFailedError:
            return Response(
                {
                    "success": False,
                    "error": (
                        "Le service d'assistance IA est temporairement indisponible. "
                        "Veuillez réessayer dans un instant."
                    ),
                    "code": "ai_providers_unavailable",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class AIAssistantPlanCommunityView(APIView):
    """
    POST /api/v1/ai-assistant/plan-community/
    Community Creation Wizard: generates a structured proposal from a concept.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["AI & Assistant"],
        summary="Planificateur / Wizard de création de communauté",
        description="Génère une proposition structurée complète (noms, description, slogan, règles, premier plan de lancement sur 7 jours) à partir d'une idée en langage naturel.",
        request=PlanCommunityRequestSerializer,
        responses={200: CommunityProposalResponseSerializer},
    )
    def post(self, request, *args, **kwargs):
        serializer = PlanCommunityRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user if request.user.is_authenticated else None
        idea = serializer.validated_data["idea"]
        language = serializer.validated_data.get("language")
        context = serializer.validated_data.get("context", {})

        try:
            proposal = AIAssistantService.plan_community(
                idea=idea,
                user=user,
                language=language,
                context=context,
            )
            return Response(
                {
                    "success": True,
                    "data": proposal.model_dump(),
                },
                status=status.HTTP_200_OK,
            )
        except AllProvidersFailedError:
            return Response(
                {
                    "success": False,
                    "error": (
                        "Le planificateur de communauté est momentanément indisponible. "
                        "Veuillez réessayer sous peu."
                    ),
                    "code": "ai_providers_unavailable",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class AIAssistantSuggestContentView(APIView):
    """
    POST /api/v1/ai-assistant/suggest-content/
    Generates actionable discussion categories, first post draft, and event ideas.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["AI & Assistant"],
        summary="Suggérer des idées de contenu et d'engagement pour une communauté",
        description="Génère un modèle de premier post, des sujets brise-glace et un calendrier d'animation.",
        request=SuggestContentRequestSerializer,
        responses={200: ContentSuggestionResponseSerializer},
    )
    def post(self, request, *args, **kwargs):
        serializer = SuggestContentRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user if request.user.is_authenticated else None
        community = serializer.validated_data["community"]
        goal = serializer.validated_data.get("goal")
        language = serializer.validated_data.get("language")

        try:
            suggestions = AIAssistantService.suggest_content(
                community_identifier=community,
                goal=goal,
                user=user,
                language=language,
            )
            return Response(
                {
                    "success": True,
                    "data": suggestions.model_dump(),
                },
                status=status.HTTP_200_OK,
            )
        except AllProvidersFailedError:
            return Response(
                {
                    "success": False,
                    "error": (
                        "Le générateur de contenu est temporairement indisponible. "
                        "Veuillez réessayer plus tard."
                    ),
                    "code": "ai_providers_unavailable",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class AIAssistantAnalyzeCommunityView(APIView):
    """
    POST /api/v1/ai-assistant/analyze-community/
    Improvement Assistant: analyzes real metrics and suggests concrete actions for owners/mods.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["AI & Assistant"],
        summary="Diagnostiquer les métriques d'une communauté et proposer des actions d'amélioration",
        description="Analyse le taux d'engagement, l'activité des membres et formule des recommandations concrètes (Réservé aux propriétaires et modérateurs).",
        request=AnalyzeCommunityRequestSerializer,
        responses={200: CommunityAnalysisResponseSerializer},
    )
    def post(self, request, *args, **kwargs):
        serializer = AnalyzeCommunityRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        community = serializer.validated_data["community"]
        language = serializer.validated_data.get("language")

        try:
            analysis = AIAssistantService.analyze_community(
                community_identifier=community,
                user=request.user,
                language=language,
            )
            return Response(
                {
                    "success": True,
                    "data": analysis.model_dump(),
                },
                status=status.HTTP_200_OK,
            )
        except AllProvidersFailedError:
            return Response(
                {
                    "success": False,
                    "error": (
                        "L'analyseur de communauté est temporairement indisponible. "
                        "Veuillez réessayer dans un instant."
                    ),
                    "code": "ai_providers_unavailable",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class AIAssistantChatView(APIView):
    """
    POST /api/v1/ai-assistant/chat/
    Conversational Assistant: answers queries, suggests follow-ups, and triggers assistant workflows.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["AI & Assistant"],
        summary="Discuter avec l'Assistant Communautaire Kodinga",
        description="Chat IA interactif avec suggestions de questions suivantes et mémorisation de session.",
        request=AssistantChatRequestSerializer,
        responses={200: AssistantChatResponseSerializer},
    )
    def post(self, request, *args, **kwargs):
        serializer = AssistantChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user if request.user.is_authenticated else None
        message = serializer.validated_data["message"]
        conversation_id = serializer.validated_data.get("conversation_id")
        community = serializer.validated_data.get("community")
        language = serializer.validated_data.get("language")

        try:
            chat_reply = AIAssistantService.chat(
                message=message,
                user=user,
                conversation_id=str(conversation_id) if conversation_id else None,
                community_identifier=community,
                language=language,
            )
            return Response(
                {
                    "success": True,
                    "data": chat_reply,
                },
                status=status.HTTP_200_OK,
            )
        except AllProvidersFailedError:
            return Response(
                {
                    "success": False,
                    "error": (
                        "L'Assistant Kodinga est temporairement indisponible. "
                        "Veuillez patienter un instant et réessayer."
                    ),
                    "code": "ai_providers_unavailable",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class AIAssistantConversationListView(APIView):
    """
    GET / POST /api/v1/ai-assistant/conversations/
    Lists past assistant conversations or initializes a new explicit discussion session.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["AI & Assistant"],
        summary="Lister les conversations de l'utilisateur",
        description="Retourne les sessions de discussion de l'utilisateur, avec historique des messages et tri chronologique.",
        parameters=[
            OpenApiParameter(
                name="context_type",
                type=str,
                description="Filtrer par type de contexte (general, discovery, creation, management)",
                required=False,
            ),
            OpenApiParameter(
                name="community",
                type=str,
                description="Filtrer par slug de communauté",
                required=False,
            ),
        ],
        responses={200: AssistantConversationSerializer(many=True)},
    )
    def get(self, request, *args, **kwargs):
        qs = AssistantConversation.objects.filter(user=request.user)

        context_type = request.query_params.get("context_type")
        if context_type:
            qs = qs.filter(context_type=context_type)

        community_slug = request.query_params.get("community")
        if community_slug:
            qs = qs.filter(community__slug=community_slug)

        conversations = qs.prefetch_related("messages")[:50]
        serializer = AssistantConversationSerializer(conversations, many=True)
        return Response(
            {
                "success": True,
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["AI & Assistant"],
        summary="Créer une nouvelle session de discussion",
        description="Initialise une nouvelle conversation avec un ID unique pour stocker l'historique d'échange.",
        request=CreateConversationRequestSerializer,
        responses={201: AssistantConversationSerializer},
    )
    def post(self, request, *args, **kwargs):
        serializer = CreateConversationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        community = None
        community_id = serializer.validated_data.get("community")
        if community_id:
            community = AIAssistantService._get_community_with_access_check(
                community_id, request.user
            )

        conversation = AssistantConversation.objects.create(
            user=request.user,
            community=community,
            title=serializer.validated_data.get("title") or "Nouvelle discussion",
            context_type=serializer.validated_data.get("context_type") or "general",
        )

        return Response(
            {
                "success": True,
                "data": AssistantConversationSerializer(conversation).data,
            },
            status=status.HTTP_201_CREATED,
        )


class AIAssistantConversationDetailView(APIView):
    """
    GET / PATCH / DELETE /api/v1/ai-assistant/conversations/<uuid:conversation_id>/
    Retrieves, updates (renames), or deletes a specific assistant conversation.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["AI & Assistant"],
        summary="Détails complets et historique d'une conversation",
        description="Retourne la conversation et tous ses messages ordonnés chronologiquement.",
        responses={200: AssistantConversationSerializer},
    )
    def get(self, request, conversation_id, *args, **kwargs):
        conversation = (
            AssistantConversation.objects.filter(id=conversation_id, user=request.user)
            .prefetch_related("messages")
            .first()
        )

        if not conversation:
            return Response(
                {"success": False, "error": "Conversation introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = AssistantConversationSerializer(conversation)
        return Response(
            {
                "success": True,
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["AI & Assistant"],
        summary="Renommer ou modifier une session de discussion",
        request=UpdateConversationRequestSerializer,
        responses={200: AssistantConversationSerializer},
    )
    def patch(self, request, conversation_id, *args, **kwargs):
        conversation = AssistantConversation.objects.filter(
            id=conversation_id, user=request.user
        ).first()

        if not conversation:
            return Response(
                {"success": False, "error": "Conversation introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = UpdateConversationRequestSerializer(
            data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)

        if "title" in serializer.validated_data:
            conversation.title = serializer.validated_data["title"]
        if "context_type" in serializer.validated_data:
            conversation.context_type = serializer.validated_data["context_type"]

        conversation.save()
        return Response(
            {
                "success": True,
                "data": AssistantConversationSerializer(conversation).data,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["AI & Assistant"],
        summary="Supprimer une conversation avec l'assistant",
        responses={200: None},
    )
    def delete(self, request, conversation_id, *args, **kwargs):
        conversation = AssistantConversation.objects.filter(
            id=conversation_id, user=request.user
        ).first()

        if not conversation:
            return Response(
                {"success": False, "error": "Conversation introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        conversation.delete()
        return Response(
            {"success": True, "message": "Conversation supprimée."},
            status=status.HTTP_200_OK,
        )


class AIAssistantConversationClearView(APIView):
    """
    POST /api/v1/ai-assistant/conversations/<uuid:conversation_id>/clear/
    Clears all messages within an existing session without deleting the conversation ID.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["AI & Assistant"],
        summary="Vider l'historique des messages d'une session",
        description="Efface tous les messages de la conversation tout en conservant son ID pour recommencer à zéro.",
        responses={200: None},
    )
    def post(self, request, conversation_id, *args, **kwargs):
        conversation = AssistantConversation.objects.filter(
            id=conversation_id, user=request.user
        ).first()

        if not conversation:
            return Response(
                {"success": False, "error": "Conversation introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        conversation.messages.all().delete()
        conversation.title = "Nouvelle discussion"
        conversation.save(update_fields=["title", "updated_at"])

        return Response(
            {
                "success": True,
                "message": "Historique de la conversation effacé avec succès.",
            },
            status=status.HTTP_200_OK,
        )
