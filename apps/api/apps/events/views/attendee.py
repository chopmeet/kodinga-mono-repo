from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.communities.selectors.community_selector import CommunitySelector
from apps.events.models.attendee import AttendeeStatus, EventAttendee
from apps.events.selectors.event_selector import EventSelector
from apps.events.serializers.attendee import (
    EventAttendeeSerializer,
    EventRSVPSerializer,
)
from apps.events.services.event_service import EventService
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response


class EventRSVPView(APIView):
    """
    Register / RSVP for an event or cancel registration.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Events"],
        summary="S'inscrire / RSVP à un événement",
        request=EventRSVPSerializer,
        responses={200: EventAttendeeSerializer},
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

        serializer = EventRSVPSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Données invalides.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details=serializer.errors,
            )

        status_val = serializer.validated_data.get("status", AttendeeStatus.ATTENDING)

        try:
            attendee = EventService.rsvp_event(
                user=request.user,
                event=event,
                status=status_val,
            )
        except Exception as e:
            msg = getattr(e, "detail", str(e))
            return error_response(str(msg), status_code=status.HTTP_400_BAD_REQUEST)

        return success_response(
            data=EventAttendeeSerializer(attendee).data,
            message="Inscription à l'événement enregistrée.",
            status_code=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Events"],
        summary="Annuler son inscription à un événement",
        responses={200: None},
    )
    def delete(self, request, slug, event_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            event = EventSelector.get_event_by_id_or_slug(
                community, event_id, user=request.user
            )
        except Exception:
            return error_response(
                "Événement introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        try:
            EventService.cancel_rsvp(user=request.user, event=event)
        except Exception as e:
            msg = getattr(e, "detail", str(e))
            return error_response(str(msg), status_code=status.HTTP_400_BAD_REQUEST)

        return success_response(
            message="Inscription annulée avec succès.",
            status_code=status.HTTP_200_OK,
        )


class EventAttendeeListView(APIView):
    """
    List registered attendees for an event.
    """

    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=["Events"],
        summary="Lister les participants d'un événement",
        responses={200: EventAttendeeSerializer(many=True)},
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

        attendees = (
            EventAttendee.objects.filter(event=event)
            .select_related("user")
            .order_by("-created_at")
        )

        if request.query_params.get("all", "").lower() in ["true", "1"]:
            return success_response(
                data=EventAttendeeSerializer(attendees, many=True).data
            )

        paginator = self.pagination_class()
        paginated_attendees = paginator.paginate_queryset(attendees, request)
        serializer = EventAttendeeSerializer(paginated_attendees, many=True)
        return paginator.get_paginated_response(serializer.data)
