from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.communities.selectors.community_selector import CommunitySelector
from apps.hackathons.selectors.hackathon_selector import HackathonSelector
from apps.hackathons.serializers.hackathon import (
    DashboardMetricsSerializer,
    HackathonCreateUpdateSerializer,
    HackathonDetailSerializer,
    HackathonListSerializer,
    LifecycleTransitionSerializer,
    UserHackathonParticipationSerializer,
)
from apps.hackathons.services.hackathon_service import HackathonService
from apps.media.services.uploadthing_service import UploadThingService


class PublicHackathonListView(APIView):
    """
    GET /api/v1/hackathons/
    Global discovery of published hackathons across all communities.
    """

    permission_classes = [AllowAny]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=["Hackathons"],
        summary="Découverte globale des hackathons",
        description="Liste l'ensemble des hackathons publiés avec filtres de recherche, format et statut.",
        parameters=[
            OpenApiParameter(name="search", type=str, required=False, description="Recherche textuelle"),
            OpenApiParameter(name="format", type=str, required=False, description="Format (online, in_person, hybrid)"),
            OpenApiParameter(name="theme", type=str, required=False, description="Filtrer par thématique"),
            OpenApiParameter(name="status", type=str, required=False, description="Filtrer par statut"),
        ],
        responses={200: HackathonListSerializer(many=True)},
    )
    def get(self, request):
        search = request.query_params.get("search")
        format_val = request.query_params.get("format")
        theme = request.query_params.get("theme")
        status_filter = request.query_params.get("status")

        qs = HackathonSelector.get_public_hackathons(
            search=search,
            format_type=format_val,
            theme=theme,
            status_filter=status_filter,
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        serializer = HackathonListSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)


class CommunityHackathonListCreateView(APIView):
    """
    GET / POST /api/v1/communities/<slug>/hackathons/
    Lists community hackathons or creates a new hackathon draft (managers only).
    """

    pagination_class = StandardResultsSetPagination
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Hackathons"],
        summary="Lister les hackathons d'une communauté",
        parameters=[
            OpenApiParameter(name="status", type=str, required=False, description="Filtrer par statut"),
        ],
        responses={200: HackathonListSerializer(many=True)},
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        status_param = request.query_params.get("status")
        qs = HackathonSelector.get_community_hackathons(
            community=community,
            user=request.user,
            status_filter=status_param,
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        serializer = HackathonListSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        tags=["Hackathons"],
        summary="Créer un nouveau hackathon (Organisateur)",
        request=HackathonCreateUpdateSerializer,
        responses={201: HackathonDetailSerializer},
    )
    def post(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = HackathonCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = dict(serializer.validated_data)
        banner_file = (
            request.FILES.get("cover_image")
            or request.FILES.get("banner")
            or request.FILES.get("cover_image_file")
        )
        if banner_file:
            upload_res = UploadThingService.upload_banner(
                user=request.user,
                file_obj=banner_file,
            )
            data["cover_image_url"] = upload_res["file_url"]

        hackathon = HackathonService.create_hackathon(
            actor=request.user,
            community=community,
            data=data,
        )

        return success_response(
            data=HackathonDetailSerializer(hackathon, context={"request": request}).data,
            message="Hackathon créé avec succès en mode brouillon.",
            status_code=status.HTTP_201_CREATED,
        )


class CommunityHackathonDetailView(APIView):
    """
    GET / PATCH / DELETE /api/v1/communities/<slug>/hackathons/<hackathon_slug>/
    Retrieves, updates, or deletes a specific hackathon.
    """

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Hackathons"],
        summary="Détails complets d'un hackathon",
        responses={200: HackathonDetailSerializer},
    )
    def get(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        return success_response(
            data=HackathonDetailSerializer(hackathon, context={"request": request}).data
        )

    @extend_schema(
        tags=["Hackathons"],
        summary="Mettre à jour un hackathon (Organisateur)",
        request=HackathonCreateUpdateSerializer,
        responses={200: HackathonDetailSerializer},
    )
    def patch(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )

        serializer = HackathonCreateUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        data = dict(serializer.validated_data)
        banner_file = (
            request.FILES.get("cover_image")
            or request.FILES.get("banner")
            or request.FILES.get("cover_image_file")
        )
        if banner_file:
            upload_res = UploadThingService.upload_banner(
                user=request.user,
                file_obj=banner_file,
                target_type="hackathon",
                target_id=str(hackathon.id),
                community_slug=hackathon.community.slug,
            )
            data["cover_image_url"] = upload_res["file_url"]
        elif str(request.data.get("remove_banner", "")).lower() in ("true", "1"):
            data["cover_image_url"] = ""

        updated = HackathonService.update_hackathon(
            actor=request.user,
            hackathon=hackathon,
            data=data,
        )
        return success_response(
            data=HackathonDetailSerializer(updated, context={"request": request}).data,
            message="Hackathon mis à jour avec succès.",
        )

    @extend_schema(
        tags=["Hackathons"],
        summary="Supprimer un hackathon (Brouillon)",
        responses={200: None},
    )
    def delete(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        HackathonService.require_manager(request.user, hackathon.community)
        hackathon.delete()
        return success_response(message="Hackathon supprimé avec succès.")


class CommunityHackathonPublishView(APIView):
    """
    POST /api/v1/communities/<slug>/hackathons/<hackathon_slug>/publish/
    Publishes a draft hackathon and announces it to community members.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = HackathonDetailSerializer

    @extend_schema(
        tags=["Hackathons"],
        summary="Publier le hackathon",
        request=None,
        responses={200: HackathonDetailSerializer},
    )
    def post(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        published = HackathonService.publish_hackathon(request.user, hackathon)
        return success_response(
            data=HackathonDetailSerializer(published, context={"request": request}).data,
            message="Hackathon publié avec succès.",
        )


class CommunityHackathonLifecycleView(APIView):
    """
    POST /api/v1/communities/<slug>/hackathons/<hackathon_slug>/lifecycle/
    Transitions hackathon lifecycle status explicitly.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Hackathons"],
        summary="Changer le statut du cycle de vie",
        request=LifecycleTransitionSerializer,
        responses={200: HackathonDetailSerializer},
    )
    def post(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        serializer = LifecycleTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = HackathonService.transition_lifecycle(
            actor=request.user,
            hackathon=hackathon,
            target_status=serializer.validated_data["status"],
        )
        return success_response(
            data=HackathonDetailSerializer(updated, context={"request": request}).data,
            message=f"Statut du hackathon changé en '{updated.status}'.",
        )


class CommunityHackathonDashboardView(APIView):
    """
    GET /api/v1/communities/<slug>/hackathons/<hackathon_slug>/dashboard/
    Real-time KPI metrics and operational summary for organizers.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Hackathons"],
        summary="Tableau de bord métriques de l'organisateur",
        responses={200: DashboardMetricsSerializer},
    )
    def get(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        metrics = HackathonService.get_dashboard_metrics(request.user, hackathon)
        return success_response(data=metrics)


class MyHackathonListView(APIView):
    """
    GET /api/v1/hackathons/my/
    List hackathons where current user is registered, has a team, or submitted a project.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = UserHackathonParticipationSerializer

    @extend_schema(
        tags=["Hackathons"],
        summary="Mes hackathons (Participant)",
        description="Liste l'ensemble des hackathons auxquels l'utilisateur participe (candidature déposée, membre d'une équipe ou projet soumis).",
        responses={200: UserHackathonParticipationSerializer(many=True)},
    )
    def get(self, request):
        participations = HackathonSelector.get_user_registered_hackathons(request.user)
        serializer = UserHackathonParticipationSerializer(
            participations, many=True, context={"request": request}
        )
        return success_response(data=serializer.data)
