import logging
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai.models.assistant import AssistantConversation
from apps.ai.providers.exceptions import AllProvidersFailedError
from apps.ai.serializers import (
    AnalyzeCommunityRequestSerializer,
    AssistantChatRequestSerializer,
    AssistantConversationSerializer,
    PlanCommunityRequestSerializer,
    RecommendCommunitiesRequestSerializer,
    SuggestContentRequestSerializer,
)
from apps.ai.services.assistant_service import AIAssistantService

logger = logging.getLogger(__name__)


class AIAssistantRecommendCommunitiesView(APIView):
    """
    POST /api/v1/ai-assistant/recommend-communities/
    Grounded discovery: returns real matching communities with explanations.
    """
    permission_classes = [AllowAny]

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
    GET /api/v1/ai-assistant/conversations/
    Lists past assistant conversations for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        conversations = AssistantConversation.objects.filter(
            user=request.user
        ).prefetch_related("messages")[:20]

        serializer = AssistantConversationSerializer(conversations, many=True)
        return Response(
            {
                "success": True,
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class AIAssistantConversationDetailView(APIView):
    """
    GET / DELETE /api/v1/ai-assistant/conversations/<uuid:conversation_id>/
    Retrieves or deletes a specific assistant conversation for the user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, conversation_id, *args, **kwargs):
        conversation = AssistantConversation.objects.filter(
            id=conversation_id, user=request.user
        ).prefetch_related("messages").first()

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
