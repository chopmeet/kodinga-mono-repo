from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.accounts.serializers.session import UserSessionSerializer
from apps.accounts.services.session import SessionService
from common.utils.responses import success_response


class UserSessionListView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSessionSerializer

    @extend_schema(
        tags=['Authentication & Accounts'],
        summary='List active user sessions',
        description='Returns a list of all active sessions and authorized devices for the current user.',
        responses={
            200: OpenApiResponse(response=UserSessionSerializer(many=True), description='Active sessions retrieved'),
            401: OpenApiResponse(description='Authentication required'),
        }
    )
    def get(self, request):
        sessions = SessionService.list_active_sessions(request.user)
        serializer = self.serializer_class(sessions, many=True)
        return success_response(data=serializer.data)


class UserSessionDetailView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSessionSerializer

    @extend_schema(
        tags=['Authentication & Accounts'],
        summary='Revoke a specific user session',
        description='Explicitly terminates a session by UUID and invalidates its refresh token.',
        responses={
            204: OpenApiResponse(description='Session successfully revoked'),
            401: OpenApiResponse(description='Authentication required'),
            404: OpenApiResponse(description='Session not found'),
        }
    )
    def delete(self, request, session_id):
        SessionService.revoke_session(request.user, session_id)
        return success_response(
            message="Session successfully revoked.",
            status_code=status.HTTP_204_NO_CONTENT
        )
