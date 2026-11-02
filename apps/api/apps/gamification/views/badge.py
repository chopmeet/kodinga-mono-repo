from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.gamification.selectors.gamification_selector import (
    GamificationSelector,
)
from apps.gamification.serializers.gamification_serializer import (
    BadgeSerializer,
    UserBadgeSerializer,
)
from common.utils.responses import success_response


class BadgeListView(APIView):
    """
    List all available achievement badges on Kodinga.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Gamification"],
        summary="Catalogue des badges de succès",
        parameters=[
            OpenApiParameter(
                name="category",
                description="Catégorie (general, community, course, event, ...)",
                required=False,
                type=str,
            ),
        ],
        responses={200: BadgeSerializer(many=True)},
    )
    def get(self, request):
        category = request.query_params.get("category")
        badges = GamificationSelector.get_available_badges(category=category)
        serializer = BadgeSerializer(badges, many=True)
        return success_response(data=serializer.data, status_code=status.HTTP_200_OK)


class UserBadgeListView(APIView):
    """
    List badges awarded to the currently authenticated developer.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Gamification"],
        summary="Badges obtenus par l'utilisateur connecté",
        responses={200: UserBadgeSerializer(many=True)},
    )
    def get(self, request):
        badges = GamificationSelector.get_user_badges(user=request.user)
        serializer = UserBadgeSerializer(badges, many=True)
        return success_response(data=serializer.data, status_code=status.HTTP_200_OK)
