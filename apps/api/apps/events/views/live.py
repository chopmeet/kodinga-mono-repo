from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.communities.models.community import CommunityPrivacy
from apps.communities.selectors.community_selector import CommunitySelector
from apps.events.models.attendee import AttendeeStatus, EventAttendee
from apps.events.models.event import Event, EventFormat, EventStatus
from apps.events.selectors.event_selector import EventSelector
from apps.events.serializers.event import (
    EventDetailSerializer,
    EventReplayAttachSerializer,
    EventStatusUpdateSerializer,
    LiveKitTokenResponseSerializer,
)
from apps.events.services.calendar_service import CalendarService
from apps.events.services.event_service import EventService
from apps.events.services.livekit_service import LiveKitService
from common.utils.responses import error_response, success_response


class EventJoinLiveView(APIView):
    """
    Join the LiveKit room for an interactive live event.
    Returns access token, server URL and audio/video permission grants.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Events"],
        summary="Rejoindre le salon LiveKit de l'événement",
        responses={200: LiveKitTokenResponseSerializer},
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

        if event.format != EventFormat.LIVEKIT:
            return error_response(
                "Cet événement n'est pas configuré pour une diffusion LiveKit.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if event.status == EventStatus.CANCELLED:
            return error_response(
                "Cet événement a été annulé.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Ensure membership or public event access
        if not event.is_public or community.privacy_type == CommunityPrivacy.SECRET:
            try:
                EventService.check_active_member(request.user, community)
            except Exception as e:
                msg = getattr(e, "detail", str(e))
                return error_response(str(msg), status_code=status.HTTP_403_FORBIDDEN)

        # Mark or create attendance & check-in
        attendee, _ = EventAttendee.objects.get_or_create(
            event=event,
            user=request.user,
            defaults={"status": AttendeeStatus.ATTENDING},
        )
        if not attendee.checked_in_at:
            attendee.checked_in_at = timezone.now()
            attendee.save(update_fields=["checked_in_at", "updated_at"])
        EventService.confirm_attendance(user=request.user, event=event)

        from common.permissions.base import is_superadmin_user
        # Determine host privileges
        is_host = (
            event.host_id == request.user.id
            or is_superadmin_user(request.user)
            or community.owner_id == request.user.id
        )

        token = LiveKitService.generate_token(
            user=request.user,
            room_name=event.live_room_name,
            is_host=is_host,
        )

        response_data = {
            "room_name": event.live_room_name,
            "token": token,
            "server_url": LiveKitService.get_server_url(),
            "is_host": is_host,
        }
        return success_response(data=response_data, status_code=status.HTTP_200_OK)


class EventStatusUpdateView(APIView):
    """
    Transition event status (scheduled -> live -> completed / cancelled).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Events"],
        summary="Changer le statut d'un événement (hôte ou gestionnaire)",
        request=EventStatusUpdateSerializer,
        responses={200: EventDetailSerializer},
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

        serializer = EventStatusUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Données invalides.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details=serializer.errors,
            )

        new_status = serializer.validated_data["status"]
        try:
            updated = EventService.update_event_status(
                actor_user=request.user,
                event=event,
                new_status=new_status,
            )
        except Exception as e:
            msg = getattr(e, "detail", str(e))
            return error_response(str(msg), status_code=status.HTTP_403_FORBIDDEN)

        return success_response(data=EventDetailSerializer(updated).data)


class EventReplayAttachView(APIView):
    """
    Attach an uploaded video asset or directly upload a recorded video file to UploadThing as replay for a finished event.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        tags=["Events"],
        summary="Associer un enregistrement / replay vidéo à l'événement",
        request=EventReplayAttachSerializer,
        responses={200: EventDetailSerializer},
    )
    def post(self, request, slug, event_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            event = EventSelector.get_event_by_id_or_slug(
                community, event_id, user=request.user
            )
        except Exception:
            return error_response(
                "Événement introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        serializer = EventReplayAttachSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Données invalides.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details=serializer.errors,
            )

        video_asset_id = serializer.validated_data.get("video_asset_id")
        video_file = serializer.validated_data.get("video")
        video_url = serializer.validated_data.get("video_url")
        try:
            updated = EventService.attach_replay(
                actor_user=request.user,
                event=event,
                video_asset_id=str(video_asset_id) if video_asset_id else None,
                video_file=video_file,
                video_url=video_url,
            )
        except Exception as e:
            msg = getattr(e, "detail", str(e))
            return error_response(str(msg), status_code=status.HTTP_400_BAD_REQUEST)

        return success_response(data=EventDetailSerializer(updated).data)


class EventCalendarDownloadView(APIView):
    """
    Export and download the event as a standard RFC 5545 iCalendar (.ics) file.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Events"],
        summary="Télécharger le fichier calendrier .ics de l'événement",
        responses={200: None},
    )
    def get(self, request, slug, event_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            event = EventSelector.get_event_by_id_or_slug(
                community, event_id, user=request.user
            )
        except Exception:
            return error_response(
                "Événement introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        ics_payload = CalendarService.generate_ics(event)
        filename = f"event-{event.slug}.ics"

        response = HttpResponse(
            ics_payload, content_type="text/calendar; charset=utf-8"
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class EventLiveKitWebhookView(APIView):
    """
    Webhook endpoint for LiveKit Server real-time room and participant lifecycle events.
    Handles room_started, room_finished, participant_joined and participant_left events.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Events"],
        summary="Webhook LiveKit pour les événements de salle en temps réel",
        responses={200: None},
    )
    def post(self, request):
        auth_header = request.headers.get("Authorization", "")
        if auth_header and not LiveKitService.verify_webhook(auth_header, request.body):
            return error_response(
                "Signature LiveKit non valide.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        event_name = request.data.get("event")
        room_info = request.data.get("room", {})
        room_name = room_info.get("name")

        if event_name == "room_started" and room_name:
            Event.objects.filter(
                live_room_name=room_name,
                status=EventStatus.SCHEDULED,
            ).update(status=EventStatus.LIVE, updated_at=timezone.now())

        elif event_name == "room_finished" and room_name:
            Event.objects.filter(
                live_room_name=room_name,
                status=EventStatus.LIVE,
            ).update(status=EventStatus.COMPLETED, updated_at=timezone.now())

        elif event_name == "participant_joined" and room_name:
            participant = request.data.get("participant", {})
            identity = participant.get("identity", "")
            if identity.startswith("user_"):
                user_id = identity.replace("user_", "")
                event = Event.objects.filter(live_room_name=room_name).first()
                if event:
                    EventAttendee.objects.filter(
                        event=event,
                        user_id=user_id,
                        checked_in_at__isnull=True,
                    ).update(checked_in_at=timezone.now(), updated_at=timezone.now())
                    from apps.accounts.models.user import User
                    participant_user = User.objects.filter(id=user_id).first()
                    if participant_user:
                        EventService.confirm_attendance(user=participant_user, event=event)

        return success_response(
            data={"received": True, "event": event_name},
            status_code=status.HTTP_200_OK,
        )
