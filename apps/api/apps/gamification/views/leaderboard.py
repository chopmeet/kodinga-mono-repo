from apps.communities.selectors.community_selector import CommunitySelector
from apps.gamification.selectors.gamification_selector import (
    GamificationSelector,
)
from apps.gamification.serializers.gamification_serializer import (
    LeaderboardEntrySerializer,
    MemberLeaderboardPositionSerializer,
)
from common.utils.responses import error_response, success_response
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


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
                name="top",
                description="Top N développeurs (ex: 3, 10, 100)",
                required=False,
                type=int,
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

        raw_limit = request.query_params.get("top") or request.query_params.get(
            "limit", 50
        )
        try:
            limit = max(1, min(int(raw_limit), 100))
        except ValueError:
            limit = 50

        leaderboard = GamificationSelector.get_global_leaderboard(
            period=period, limit=limit
        )
        serializer = LeaderboardEntrySerializer(leaderboard, many=True)
        return success_response(
            data=serializer.data, status_code=status.HTTP_200_OK
        )


class CommunityLeaderboardView(APIView):
    """
    Retrieve developer ranking scoped and isolated to a specific community.
    Supports Top 3 / Top 10 / Top 100 presets, tie-handling, pagination,
    and returns the authenticated member's own position in `meta.current_user`.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Gamification"],
        summary="Classement des membres d'une communauté (Leaderboard)",
        parameters=[
            OpenApiParameter(
                name="top",
                description="Filtrer les meilleurs membres : 3 (Top 3), 10 (Top 10), 100 (Top 100)",
                required=False,
                type=int,
            ),
            OpenApiParameter(
                name="limit",
                description="Nombre maximum de membres à retourner (max 100)",
                required=False,
                type=int,
            ),
            OpenApiParameter(
                name="page",
                description="Numéro de page pour la pagination (défaut: 1)",
                required=False,
                type=int,
            ),
            OpenApiParameter(
                name="page_size",
                description="Taille de page (défaut: 50, max: 100)",
                required=False,
                type=int,
            ),
            OpenApiParameter(
                name="period",
                description="Période : all_time (défaut), monthly, weekly",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="include_all_members",
                description="Inclure aussi les membres actifs ayant 0 point (true/false)",
                required=False,
                type=bool,
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

        period = request.query_params.get("period", "all_time")
        if period not in ["all_time", "monthly", "weekly"]:
            period = "all_time"

        top = None
        if "top" in request.query_params:
            try:
                top = max(1, min(int(request.query_params["top"]), 100))
            except ValueError:
                top = None

        limit = None
        if "limit" in request.query_params:
            try:
                limit = max(1, min(int(request.query_params["limit"]), 100))
            except ValueError:
                limit = 50

        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except ValueError:
            page = 1

        try:
            default_ps = top or limit or 50
            page_size = max(
                1,
                min(int(request.query_params.get("page_size", default_ps)), 100),
            )
        except ValueError:
            page_size = 50

        include_all_members = request.query_params.get(
            "include_all_members", ""
        ).lower() in ("true", "1", "yes")

        result = GamificationSelector.get_community_leaderboard_paginated(
            community=community,
            top=top,
            limit=limit,
            page=page,
            page_size=page_size,
            period=period,
            include_all_members=include_all_members,
            current_user=request.user,
        )

        entries_data = LeaderboardEntrySerializer(
            result["entries"], many=True
        ).data
        current_user_data = (
            LeaderboardEntrySerializer(result["current_user_entry"]).data
            if result["current_user_entry"] is not None
            else None
        )

        meta = dict(result["meta"])
        meta["current_user"] = current_user_data

        return Response(
            {
                "success": True,
                "data": entries_data,
                "meta": meta,
            },
            status=status.HTTP_200_OK,
        )


class CommunityMyLeaderboardPositionView(APIView):
    """
    GET /api/v1/communities/<slug:slug>/leaderboard/me/
    GET /api/v1/communities/<slug:slug>/gamification/leaderboard/me/
    Returns the authenticated member's exact position, rank, points, level,
    points needed for the next rank, and surrounding members in the community.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Gamification"],
        summary="Obtenir la position du membre connecté dans le classement de la communauté",
        parameters=[
            OpenApiParameter(
                name="period",
                description="Période : all_time (défaut), monthly, weekly",
                required=False,
                type=str,
            ),
        ],
        responses={200: MemberLeaderboardPositionSerializer},
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

        period = request.query_params.get("period", "all_time")
        if period not in ["all_time", "monthly", "weekly"]:
            period = "all_time"

        pos_data = GamificationSelector.get_member_leaderboard_position(
            community=community,
            user=request.user,
            period=period,
        )
        serializer = MemberLeaderboardPositionSerializer(pos_data)
        return success_response(
            data=serializer.data, status_code=status.HTTP_200_OK
        )
