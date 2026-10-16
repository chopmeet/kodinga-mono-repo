from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.gamification.selectors.gamification_selector import (
    GamificationSelector,
)
from apps.gamification.serializers.gamification_serializer import (
    ReputationTransactionSerializer,
    UserReputationSerializer,
)
from common.utils.responses import success_response


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
        return success_response(data=serializer.data, status_code=status.HTTP_200_OK)


class ReputationHistoryView(APIView):
    """
    Retrieve audit history of reputation point gains and penalties.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Gamification"],
        summary="Historique des transactions de points de réputation",
        responses={200: ReputationTransactionSerializer(many=True)},
    )
    def get(self, request):
        transactions = GamificationSelector.get_user_transactions(user=request.user)
        serializer = ReputationTransactionSerializer(transactions, many=True)
        return success_response(data=serializer.data, status_code=status.HTTP_200_OK)
