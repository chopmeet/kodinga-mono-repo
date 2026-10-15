from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.ai.services.health_service import ProviderHealthService
from common.permissions.base import is_superadmin_user
from common.utils.responses import error_response, success_response


class AIProviderHealthView(APIView):
    """
    Administrator endpoint monitoring Gemini and OpenAI provider availability,
    circuit breaker status, latency statistics, and fallback frequency.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["AI Services"],
        summary="État de santé des fournisseurs IA (Gemini & OpenAI)",
        responses={200: None},
    )
    def get(self, request):
        if not (is_superadmin_user(request.user) or request.user.is_staff):
            return error_response(
                "Accès restreint aux administrateurs système.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        health_data = ProviderHealthService.get_health_status()
        return success_response(data=health_data, status_code=status.HTTP_200_OK)
