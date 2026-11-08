from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.profiles.selectors.profile_selector import ProfileSelector
from apps.profiles.serializers.profile import (
    DeveloperProfileDetailSerializer,
    DeveloperProfileUpdateSerializer,
    PublicProfileSummarySerializer,
)
from apps.profiles.services.profile_service import ProfileService
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response


class MeProfileView(APIView):
    """
    Endpoints for the authenticated user to retrieve and update their full developer profile.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Profiles"],
        summary="Consulter son profil développeur complet",
        responses={200: DeveloperProfileDetailSerializer},
    )
    def get(self, request):
        profile = ProfileSelector.get_profile_by_user(request.user)
        serializer = DeveloperProfileDetailSerializer(
            profile, context={"request": request}
        )
        return success_response(data=serializer.data)

    @extend_schema(
        tags=["Profiles"],
        summary="Mettre à jour son profil développeur",
        request=DeveloperProfileUpdateSerializer,
        responses={200: DeveloperProfileDetailSerializer},
    )
    def patch(self, request):
        serializer = DeveloperProfileUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        ProfileService.update_profile(request.user, serializer.validated_data)
        updated_profile = ProfileSelector.get_profile_by_user(request.user)
        return success_response(
            data=DeveloperProfileDetailSerializer(
                updated_profile, context={"request": request}
            ).data,
            message="Profil mis à jour avec succès.",
        )

    @extend_schema(
        tags=["Profiles"],
        summary="Remplacer intégralement son profil développeur",
        request=DeveloperProfileUpdateSerializer,
        responses={200: DeveloperProfileDetailSerializer},
    )
    def put(self, request):
        return self.patch(request)


class PublicProfileDetailView(APIView):
    """
    Publicly accessible detailed developer profile by username.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Profiles"],
        summary="Consulter le profil public d'un développeur par son username",
        parameters=[
            OpenApiParameter(
                name="username",
                description="Nom d'utilisateur (avec ou sans @)",
                required=True,
                type=str,
                location=OpenApiParameter.PATH,
            )
        ],
        responses={200: DeveloperProfileDetailSerializer},
    )
    def get(self, request, username):
        clean_username = username.lstrip("@")
        try:
            profile = ProfileSelector.get_public_profile_by_username(clean_username)
        except Exception:
            return error_response(
                message="Profil développeur introuvable ou privé.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Track view count safely (avoid self-views)
        if not request.user.is_authenticated or request.user.id != profile.user_id:
            ProfileService.increment_profile_views(profile)

        serializer = DeveloperProfileDetailSerializer(
            profile, context={"request": request}
        )
        return success_response(data=serializer.data)


class PublicProfileListView(APIView):
    """
    Public directory of developers with advanced filtering and search.
    """

    permission_classes = [AllowAny]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=["Profiles"],
        summary="Annuaire & Recherche publique de profils développeurs",
        parameters=[
            OpenApiParameter(
                name="q",
                description="Recherche par mot-clé (nom, headline, bio)",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="tech",
                description="Filtrer par slug de technologies (séparés par virgule)",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="location",
                description="Filtrer par lieu",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="availability",
                description="Statut de disponibilité",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="min_exp",
                description="Années d'expérience minimum",
                required=False,
                type=int,
            ),
            OpenApiParameter(
                name="is_mentor",
                description="Est mentor (true/false)",
                required=False,
                type=bool,
            ),
            OpenApiParameter(
                name="freelance",
                description="Ouvert au freelance (true/false)",
                required=False,
                type=bool,
            ),
            OpenApiParameter(
                name="remote",
                description="Ouvert au remote (true/false)",
                required=False,
                type=bool,
            ),
        ],
        responses={200: PublicProfileSummarySerializer(many=True)},
    )
    def get(self, request):
        q = request.query_params.get("q")
        tech_param = request.query_params.get("tech")
        technologies = (
            [t.strip() for t in tech_param.split(",")] if tech_param else None
        )
        location = request.query_params.get("location")
        availability = request.query_params.get("availability")

        min_exp_param = request.query_params.get("min_exp")
        min_exp = (
            int(min_exp_param) if min_exp_param and min_exp_param.isdigit() else None
        )

        is_mentor = request.query_params.get("is_mentor")
        is_mentor_bool = is_mentor.lower() in ("true", "1") if is_mentor else None

        freelance = request.query_params.get("freelance")
        freelance_bool = freelance.lower() in ("true", "1") if freelance else None

        remote = request.query_params.get("remote")
        remote_bool = remote.lower() in ("true", "1") if remote else None

        queryset = ProfileSelector.search_profiles(
            search_query=q,
            technologies=technologies,
            location=location,
            availability=availability,
            min_years_exp=min_exp,
            is_mentor=is_mentor_bool,
            open_to_freelance=freelance_bool,
            open_to_remote=remote_bool,
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = PublicProfileSummarySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
