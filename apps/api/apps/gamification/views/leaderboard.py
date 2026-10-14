from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.communities.selectors.community_selector import CommunitySelector
from apps.gamification.selectors.gamification_selector import (
    GamificationSelector,
)
from apps.gamification.serializers.gamification_serializer import (
    LeaderboardEntrySerializer,
)
from common.utils.responses import error_response, success_response


class GlobalLeaderboardView(APIView):
    """
    Retrieve global developer ranking based on points / activity.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Gamification"],
        summary="Classement global des développeurs (Leaderboard)",
        parameters=[
            OpenApiParameter(
                name="period",
                description="Période du classement : all_time, monthly, weekly",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="limit",
                description="Nombre de développeurs à retourner (max 100)",
                required=False,
                type=int,
            ),
        ],
        responses={200: LeaderboardEntrySerializer(many=True)},
    )
    def get(self, request):
        period = request.query_params.get("period", "all_time")
        if period not in ["all_time", "monthly", "weekly"]:
            period = "all_time"

        try:
            limit = min(int(request.query_params.get("limit", 50)), 100)
        except ValueError:
            limit = 50

        leaderboard = GamificationSelector.get_global_leaderboard(
            period=period, limit=limit
        )
        serializer = LeaderboardEntrySerializer(leaderboard, many=True)
        return success_response(data=serializer.data, status_code=status.HTTP_200_OK)


class CommunityLeaderboardView(APIView):
    """
    Retrieve developer ranking scoped to a specific community.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Gamification"],
        summary="Classement des membres d'une communauté",
        parameters=[
            OpenApiParameter(
                name="limit",
                description="Nombre de membres à retourner (max 100)",
                required=False,
                type=int,
            ),
        ],
        responses={200: LeaderboardEntrySerializer(many=True)},
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(
                slug, user=request.user
            )
        except Exception:
            return error_response(
                "Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        try:
            limit = min(int(request.query_params.get("limit", 50)), 100)
        except ValueError:
            limit = 50

        leaderboard = GamificationSelector.get_community_leaderboard(
            community=community, limit=limit
        )
        serializer = LeaderboardEntrySerializer(leaderboard, many=True)
        return success_response(data=serializer.data, status_code=status.HTTP_200_OK)
