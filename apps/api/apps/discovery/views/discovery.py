from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.discovery.serializers.discovery_serializer import (
    DiscoveryRecommendationsResponseSerializer,
    DiscoverySearchResponseSerializer,
    DiscoveryTrendingResponseSerializer,
)
from apps.discovery.services.discovery_service import DiscoveryService
from common.utils.responses import success_response


class DiscoverySearchView(APIView):
    """
    Unified global multi-domain search across communities, courses,
    live events, developers and discussions.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Discovery"],
        summary="Recherche globale unifiée multi-domaines",
        parameters=[
            OpenApiParameter(
                name="q",
                description="Mots-clés recherchés",
                required=True,
                type=str,
            ),
            OpenApiParameter(
                name="type",
                description="Type cible (community, course, event, developer, post)",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="limit",
                description="Nombre de résultats par catégorie (défaut 10)",
                required=False,
                type=int,
            ),
        ],
        responses={200: DiscoverySearchResponseSerializer},
    )
    def get(self, request):
        query = request.query_params.get("q", "").strip()
        content_type = request.query_params.get("type")
        try:
            limit = min(int(request.query_params.get("limit", 10)), 50)
        except ValueError:
            limit = 10

        user = request.user if request.user.is_authenticated else None
        results = DiscoveryService.search_all(
            query=query,
            content_type=content_type,
            limit=limit,
            user=user,
        )
        serializer = DiscoverySearchResponseSerializer(results)
        return success_response(
            data=serializer.data,
            message="Résultats de recherche récupérés.",
            status_code=status.HTTP_200_OK,
        )


class DiscoveryTrendingView(APIView):
    """
    Retrieve trending communities, popular courses and upcoming live events.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Discovery"],
        summary="Tendances de la plateforme (communautés, cours, événements)",
        parameters=[
            OpenApiParameter(
                name="limit",
                description="Nombre d'éléments par catégorie (défaut 6)",
                required=False,
                type=int,
            ),
        ],
        responses={200: DiscoveryTrendingResponseSerializer},
    )
    def get(self, request):
        try:
            limit = min(int(request.query_params.get("limit", 6)), 30)
        except ValueError:
            limit = 6

        trending = DiscoveryService.get_trending(limit=limit)
        serializer = DiscoveryTrendingResponseSerializer(trending)
        return success_response(
            data=serializer.data,
            message="Contenus tendances récupérés.",
            status_code=status.HTTP_200_OK,
        )


class DiscoveryRecommendationsView(APIView):
    """
    Tailored community and course suggestions based on the developer's tech stack.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Discovery"],
        summary="Recommandations personnalisées pour le développeur",
        parameters=[
            OpenApiParameter(
                name="limit",
                description="Nombre d'éléments recommandés (défaut 6)",
                required=False,
                type=int,
            ),
        ],
        responses={200: DiscoveryRecommendationsResponseSerializer},
    )
    def get(self, request):
        try:
            limit = min(int(request.query_params.get("limit", 6)), 30)
        except ValueError:
            limit = 6

        user = request.user if request.user.is_authenticated else None
        recommendations = DiscoveryService.get_recommendations(
            user=user, limit=limit
        )
        serializer = DiscoveryRecommendationsResponseSerializer(recommendations)
        return success_response(
            data=serializer.data,
            message="Recommandations personnalisées récupérées.",
            status_code=status.HTTP_200_OK,
        )
