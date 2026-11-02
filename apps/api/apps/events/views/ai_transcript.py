from common.utils.responses import error_response, success_response
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.communities.selectors.community_selector import CommunitySelector
from apps.events.selectors.event_selector import EventSelector
from apps.events.serializers.event import (
    EventChatTranscriptRequestSerializer,
    EventChatTranscriptResponseSerializer,
    EventSummaryResponseSerializer,
    EventTranscribeRequestSerializer,
    EventTranscriptionResponseSerializer,
)
from apps.events.services.transcription_service import EventTranscriptionService


class EventTranscribeView(APIView):
    """
    Trigger or refresh the AI transcription and summary of a live event replay.
    Host or community managers can force refresh.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Events"],
        summary="Transcrire le live enregistré (replay) et générer son résumé IA",
        request=EventTranscribeRequestSerializer,
        responses={200: EventTranscriptionResponseSerializer},
    )
    def post(self, request, slug, event_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            event = EventSelector.get_event_by_id_or_slug(
                community, event_id, user=request.user
            )
        except PermissionDenied as e:
            msg = getattr(e, "detail", str(e))
            return error_response(str(msg), status_code=status.HTTP_403_FORBIDDEN)
        except Exception:
            return error_response(
                "Événement introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        try:
            EventTranscriptionService.check_can_transcribe(request.user, event)
        except PermissionDenied as e:
            msg = getattr(e, "detail", str(e))
            return error_response(str(msg), status_code=status.HTTP_403_FORBIDDEN)

        serializer = EventTranscribeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Données invalides.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details=serializer.errors,
            )

        force = serializer.validated_data.get("force", False)
        language = serializer.validated_data.get("language", "fr")

        try:
            result = EventTranscriptionService.trigger_transcription_async(
                event=event, language=language, force=force
            )
            return success_response(
                data=EventTranscriptionResponseSerializer(result).data,
                message="Traitement asynchrone de la transcription lancé en arrière-plan.",
                status_code=status.HTTP_202_ACCEPTED if result.get("status") == "processing" else status.HTTP_200_OK,
            )
        except Exception as e:
            return error_response(
                f"Échec de la transcription : {e}",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class EventTranscriptionDetailView(APIView):
    """
    Retrieve the existing transcription and summary for an event replay.
    Accessible to members (or any user if public).
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Events"],
        summary="Récupérer la transcription et le résumé du live enregistré",
        responses={200: EventTranscriptionResponseSerializer},
    )
    def get(self, request, slug, event_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            event = EventSelector.get_event_by_id_or_slug(
                community, event_id, user=request.user
            )
        except PermissionDenied as e:
            msg = getattr(e, "detail", str(e))
            return error_response(str(msg), status_code=status.HTTP_403_FORBIDDEN)
        except Exception:
            return error_response(
                "Événement introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        try:
            EventTranscriptionService.check_access(request.user, event)
        except PermissionDenied as e:
            msg = getattr(e, "detail", str(e))
            return error_response(str(msg), status_code=status.HTTP_403_FORBIDDEN)

        result = EventTranscriptionService.get_transcription(event)
        return success_response(
            data=EventTranscriptionResponseSerializer(result).data
        )


class EventSummaryGenerateView(APIView):
    """
    Generate or retrieve the executive summary of the live event.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Events"],
        summary="Générer ou rafraîchir le résumé du live",
        responses={200: EventSummaryResponseSerializer},
    )
    def post(self, request, slug, event_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            event = EventSelector.get_event_by_id_or_slug(
                community, event_id, user=request.user
            )
        except PermissionDenied as e:
            msg = getattr(e, "detail", str(e))
            return error_response(str(msg), status_code=status.HTTP_403_FORBIDDEN)
        except Exception:
            return error_response(
                "Événement introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        try:
            EventTranscriptionService.check_access(request.user, event)
        except PermissionDenied as e:
            msg = getattr(e, "detail", str(e))
            return error_response(str(msg), status_code=status.HTTP_403_FORBIDDEN)

        result = EventTranscriptionService.generate_summary(event)
        return success_response(
            data=EventSummaryResponseSerializer(result).data,
            message="Résumé généré avec succès.",
        )


class EventChatTranscriptView(APIView):
    """
    Chat with docs / transcript: Allows members to interactively question the live meeting transcript.
    Grounds answers strictly on what was said during the event.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Events"],
        summary="Chat with docs : Poser une question sur ce qui s'est dit durant le live",
        request=EventChatTranscriptRequestSerializer,
        responses={200: EventChatTranscriptResponseSerializer},
    )
    def post(self, request, slug, event_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            event = EventSelector.get_event_by_id_or_slug(
                community, event_id, user=request.user
            )
        except PermissionDenied as e:
            msg = getattr(e, "detail", str(e))
            return error_response(str(msg), status_code=status.HTTP_403_FORBIDDEN)
        except Exception:
            return error_response(
                "Événement introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        try:
            EventTranscriptionService.check_access(request.user, event)
        except PermissionDenied as e:
            msg = getattr(e, "detail", str(e))
            return error_response(str(msg), status_code=status.HTTP_403_FORBIDDEN)

        serializer = EventChatTranscriptRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Données invalides.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details=serializer.errors,
            )

        message = serializer.validated_data["message"]
        history = serializer.validated_data.get("history", [])
        language = serializer.validated_data.get("language", "fr")

        result = EventTranscriptionService.chat_with_transcript(
            event=event,
            message=message,
            history=history,
            language=language,
        )

        return success_response(
            data=EventChatTranscriptResponseSerializer(result).data
        )
