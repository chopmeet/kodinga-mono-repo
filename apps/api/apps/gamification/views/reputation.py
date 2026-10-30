from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.accounts.models.user import User
from apps.communities.selectors.community_selector import CommunitySelector
from apps.gamification.selectors.gamification_selector import (
    GamificationSelector,
)
from apps.gamification.serializers.gamification_serializer import (
    CommunityGamificationStatsSerializer,
    MemberCommunityPointsSerializer,
    ReputationTransactionSerializer,
    UserReputationSerializer,
)
from common.utils.responses import error_response, success_response


class UserReputationDetailView(APIView):
    """
    Retrieve gamification reputation profile (XP, level, streak,
    rank title) for the authenticated user.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Gamification"],
        summary="Profil de réputation, XP et niveau de l'utilisateur",
        responses={200: UserReputationSerializer},
    )
    def get(self, request):
        reputation = GamificationSelector.get_user_reputation(user=request.user)
        serializer = UserReputationSerializer(reputation)
        return success_response(
            data=serializer.data, status_code=status.HTTP_200_OK
        )


class ReputationHistoryView(APIView):
    """
    Retrieve audit history of reputation point gains and penalties for the
    authenticated user (globally or filtered by community/action/source).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Gamification"],
        summary="Historique des transactions de points de réputation du membre connecté",
        parameters=[
            OpenApiParameter(
                name="community",
                description="Filtrer par slug de communauté",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="action",
                description="Filtrer par type d'activité (course_completed, event_attended, post_created, manual_adjustment, ...)",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="source",
                description="Filtrer par source (automatic, manual_adjustment, badge_reward)",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="limit",
                description="Nombre max d'entrées (défaut: 50, max: 200)",
                required=False,
                type=int,
            ),
        ],
        responses={200: ReputationTransactionSerializer(many=True)},
    )
    def get(self, request):
        community = None
        community_slug = request.query_params.get("community")
        if community_slug:
            try:
                community = CommunitySelector.get_community_by_slug(
                    community_slug, user=request.user
                )
            except Exception:
                return error_response(
                    "Communauté introuvable.",
                    status_code=status.HTTP_404_NOT_FOUND,
                )

        action = request.query_params.get("action")
        source = request.query_params.get("source")
        try:
            limit = max(
                1, min(int(request.query_params.get("limit", 50)), 200)
            )
        except ValueError:
            limit = 50

        transactions = GamificationSelector.get_user_transactions(
            user=request.user,
            limit=limit,
            community=community,
            action=action,
            source=source,
        )
        serializer = ReputationTransactionSerializer(transactions, many=True)
        return success_response(
            data=serializer.data, status_code=status.HTTP_200_OK
        )


class CommunityMemberPointsMeView(APIView):
    """
    GET /api/v1/communities/<slug:slug>/gamification/points/me/
    Returns the authenticated member's total points, level, rank, and
    breakdown by activity inside a specific community.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Gamification"],
        summary="Récupérer le total des points et le résumé du membre connecté dans une communauté",
        responses={200: MemberCommunityPointsSerializer},
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

        summary = GamificationSelector.get_member_community_points(
            user=request.user, community=community
        )
        serializer = MemberCommunityPointsSerializer(summary)
        return success_response(
            data=serializer.data, status_code=status.HTTP_200_OK
        )


class CommunityMemberPointsDetailView(APIView):
    """
    GET /api/v1/communities/<slug:slug>/gamification/members/<uuid:user_id>/points/
    Returns a specific member's total points, level, rank, and breakdown
    by activity inside a specific community.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Gamification"],
        summary="Récupérer le total des points d'un membre spécifique dans une communauté",
        responses={200: MemberCommunityPointsSerializer},
    )
    def get(self, request, slug, user_id):
        try:
            community = CommunitySelector.get_community_by_slug(
                slug, user=request.user
            )
        except Exception:
            return error_response(
                "Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        target_user = (
            User.objects.filter(id=user_id, is_active=True)
            .select_related("profile")
            .first()
        )
        if not target_user:
            return error_response(
                "Membre introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        summary = GamificationSelector.get_member_community_points(
            user=target_user, community=community
        )
        serializer = MemberCommunityPointsSerializer(summary)
        return success_response(
            data=serializer.data, status_code=status.HTTP_200_OK
        )


class CommunityMemberPointsHistoryView(APIView):
    """
    GET /api/v1/communities/<slug:slug>/gamification/points/history/
    Returns the authenticated member's point transaction history within a specific community.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Gamification"],
        summary="Récupérer l'historique des points du membre connecté dans une communauté",
        parameters=[
            OpenApiParameter(
                name="action",
                description="Filtrer par activité (course_completed, event_attended, post_created, manual_adjustment)",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="source",
                description="Filtrer par source (automatic, manual_adjustment, badge_reward)",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="limit",
                description="Nombre max d'entrées (défaut: 50, max: 200)",
                required=False,
                type=int,
            ),
        ],
        responses={200: ReputationTransactionSerializer(many=True)},
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

        action = request.query_params.get("action")
        source = request.query_params.get("source")
        try:
            limit = max(
                1, min(int(request.query_params.get("limit", 50)), 200)
            )
        except ValueError:
            limit = 50

        transactions = GamificationSelector.get_user_transactions(
            user=request.user,
            limit=limit,
            community=community,
            action=action,
            source=source,
        )
        serializer = ReputationTransactionSerializer(transactions, many=True)
        return success_response(
            data=serializer.data, status_code=status.HTTP_200_OK
        )


class CommunityGamificationStatsView(APIView):
    """
    GET /api/v1/communities/<slug:slug>/gamification/stats/
    Returns global gamification statistics for a community:
    total points awarded, breakdown by activity, active rewarded members, and Top 3.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Gamification"],
        summary="Récupérer les statistiques globales de gamification d'une communauté",
        responses={200: CommunityGamificationStatsSerializer},
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

        stats_data = GamificationSelector.get_community_gamification_stats(
            community=community
        )
        serializer = CommunityGamificationStatsSerializer(stats_data)
        return success_response(
            data=serializer.data, status_code=status.HTTP_200_OK
        )
