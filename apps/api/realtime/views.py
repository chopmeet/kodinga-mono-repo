from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from realtime.auth import RealtimeAuthService


@extend_schema(tags=["Messaging & Notifications"])
class WebSocketTicketView(APIView):
    """
    Generates a single-use, short-lived (30s) authentication ticket for WebSocket connections.
    """

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="Générer un ticket d'authentification WebSocket temporaire (TTL 30s)",
        description=(
            "Retourne un ticket cryptographique à usage unique permettant d'établir "
            "une connexion WebSocket sécurisée sur /ws/?ticket=<ticket>."
        ),
        responses={200: dict},
    )
    def post(self, request):
        ticket_data = RealtimeAuthService.create_ticket(request.user)
        return Response(ticket_data, status=status.HTTP_200_OK)
