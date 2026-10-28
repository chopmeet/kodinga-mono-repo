from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.communities.selectors.community_selector import CommunitySelector
from apps.events.selectors.event_selector import EventSelector
from apps.events.serializers.event import (
    EventCreateUpdateSerializer,
    EventDetailSerializer,
    EventSerializer,
)
from apps.events.services.event_service import EventService
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response


class CommunityEventListView(APIView):
    """
    List events in a community or schedule a new event (community managers).
    """

    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Events"],
        summary="Lister les événements d'une communauté",
        parameters=[
            OpenApiParameter(
                name="status",
                description=(
                    "Filtrer par statut (scheduled, live, completed, cancelled)"
                ),
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="event_type",
                description=(
                    "Filtrer par type (webinar, workshop, ama, meetup, etc.)"
                ),
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="upcoming",
                description="Filtrer événements à venir (true) ou passés (false)",
                required=False,
                type=bool,
            ),
            OpenApiParameter(
                name="has_replay",
                description="Filtrer les événements avec replay vidéo (true/false)",
                required=False,
                type=bool,
            ),
            OpenApiParameter(
                name="all",
                description="Retourner sans pagination (défaut: false)",
                required=False,
                type=bool,
            ),
        ],
        responses={200: EventSerializer(many=True)},
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response(
                "Communauté introuvable.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        status_param = request.query_params.get("status")
        event_type = request.query_params.get("event_type")
        upcoming_param = request.query_params.get("upcoming")
        upcoming = None
        if upcoming_param is not None:
            upcoming = upcoming_param.lower() in ["true", "1"]

        has_replay_param = request.query_params.get("has_replay")
        has_replay = None
        if has_replay_param is not None:
            has_replay = has_replay_param.lower() in ["true", "1"]

        events = EventSelector.list_community_events(
            community=community,
            user=request.user if request.user.is_authenticated else None,
            status=status_param,
            event_type=event_type,
            upcoming=upcoming,
            has_replay=has_replay,
        )

        if request.query_params.get("all", "").lower() in ["true", "1"]:
            serializer = EventSerializer(events, many=True)
            return success_response(data=serializer.data)

        paginator = self.pagination_class()
        paginated_events = paginator.paginate_queryset(events, request)
        serializer = EventSerializer(paginated_events, many=True)
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        tags=["Events"],
        summary="Créer un nouvel événement dans la communauté",
        request=EventCreateUpdateSerializer,
        responses={201: EventDetailSerializer},
    )
    def post(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response(
                "Communauté introuvable.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        serializer = EventCreateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Données invalides.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details=serializer.errors,
            )

        try:
            event = EventService.create_event(
                actor_user=request.user,
                community=community,
                data=serializer.validated_data,
            )
        except Exception as e:
            msg = getattr(e, "detail", str(e))
            return error_response(
                str(msg),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return success_response(
            data=EventDetailSerializer(event).data,
            status_code=status.HTTP_201_CREATED,
        )


class CommunityEventDetailView(APIView):
    """
    Retrieve, update or delete a community event.
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Events"],
        summary="Détails d'un événement",
        responses={200: EventDetailSerializer},
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
        except Exception as e:
            msg = getattr(e, "detail", "Événement introuvable.")
            return error_response(str(msg), status_code=status.HTTP_404_NOT_FOUND)

        return success_response(data=EventDetailSerializer(event).data)

    @extend_schema(
        tags=["Events"],
        summary="Modifier un événement (hôte ou gestionnaire)",
        request=EventCreateUpdateSerializer,
        responses={200: EventDetailSerializer},
    )
    def patch(self, request, slug, event_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            event = EventSelector.get_event_by_id_or_slug(
                community, event_id, user=request.user
            )
        except Exception:
            return error_response(
                "Événement introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        serializer = EventCreateUpdateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response(
                "Données invalides.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details=serializer.errors,
            )

        try:
            updated = EventService.update_event(
                actor_user=request.user,
                event=event,
                data=serializer.validated_data,
            )
        except Exception as e:
            msg = getattr(e, "detail", str(e))
            return error_response(str(msg), status_code=status.HTTP_400_BAD_REQUEST)

        return success_response(data=EventDetailSerializer(updated).data)

    @extend_schema(
        tags=["Events"],
        summary="Supprimer un événement (hôte ou gestionnaire)",
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
            EventService.delete_event(actor_user=request.user, event=event)
        except Exception as e:
            msg = getattr(e, "detail", str(e))
            return error_response(str(msg), status_code=status.HTTP_403_FORBIDDEN)

        return success_response(
            message="Événement supprimé avec succès.",
            status_code=status.HTTP_200_OK,
        )


class UserAttendingEventListView(APIView):
    """
    List all upcoming events that the authenticated user has registered/RSVP'd for.
    """

    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=["Events"],
        summary="Mes événements inscrits à venir",
        responses={200: EventSerializer(many=True)},
    )
    def get(self, request):
        events = EventSelector.list_user_attending_events(request.user)
        if request.query_params.get("all", "").lower() in ["true", "1"]:
            return success_response(data=EventSerializer(events, many=True).data)

        paginator = self.pagination_class()
        paginated_events = paginator.paginate_queryset(events, request)
        serializer = EventSerializer(paginated_events, many=True)
        return paginator.get_paginated_response(serializer.data)


class PublicEventListView(APIView):
    """
    List all public events across communities, including public events hosted in private communities.
    Accessible to all users (authenticated or anonymous).
    """

    permission_classes = [AllowAny]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=["Events"],
        summary="Découvrir les événements publics (y compris des communautés privées)",
        parameters=[
            OpenApiParameter(
                name="format",
                description="Filtrer par format (livekit, external, in_person, hybrid)",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="event_type",
                description="Filtrer par type d'événement (webinar, workshop, ama, meetup, etc.)",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="upcoming",
                description="Filtrer événements à venir (true) ou passés (false)",
                required=False,
                type=bool,
            ),
            OpenApiParameter(
                name="search",
                description="Recherche textuelle dans le titre, description, lieu ou communauté",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="all",
                description="Retourner sans pagination (défaut: false)",
                required=False,
                type=bool,
            ),
        ],
        responses={200: EventSerializer(many=True)},
    )
    def get(self, request):
        format_param = request.query_params.get("format")
        event_type = request.query_params.get("event_type")
        upcoming_param = request.query_params.get("upcoming")
        search = request.query_params.get("search")

        upcoming = None
        if upcoming_param is not None:
            upcoming = upcoming_param.lower() in ["true", "1"]

        events = EventSelector.list_public_events(
            user=request.user if request.user.is_authenticated else None,
            format_val=format_param,
            event_type=event_type,
            upcoming=upcoming,
            search=search,
        )

        if request.query_params.get("all", "").lower() in ["true", "1"]:
            serializer = EventSerializer(events, many=True)
            return success_response(data=serializer.data)

        paginator = self.pagination_class()
        paginated_events = paginator.paginate_queryset(events, request)
        serializer = EventSerializer(paginated_events, many=True)
        return paginator.get_paginated_response(serializer.data)

