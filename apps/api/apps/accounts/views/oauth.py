from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from common.serializers.base import EmptySerializer
from common.utils.responses import success_response
from apps.accounts.serializers.oauth import OAuthCallbackSerializer
from apps.accounts.serializers.user import UserSerializer
from apps.accounts.services.oauth import OAuthService


class OAuthStartView(APIView):
    permission_classes = [AllowAny]
    serializer_class = EmptySerializer

    @extend_schema(
        tags=['Authentication & Accounts'],
        summary='Initialize OAuth Authorization URL',
        description='Generates a secure OAuth authorization URL with anti-CSRF state token for Google or GitHub.',
        responses={
            200: OpenApiResponse(description='Authorization URL and generated state'),
            400: OpenApiResponse(description='Unsupported OAuth provider'),
        }
    )
    def get(self, request, provider):
        redirect_uri = request.query_params.get('redirect_uri')
        result = OAuthService.get_authorization_url(provider=provider, redirect_uri=redirect_uri)
        return success_response(data=result)


class OAuthCallbackView(APIView):
    permission_classes = [AllowAny]
    serializer_class = OAuthCallbackSerializer

    @extend_schema(
        tags=['Authentication & Accounts'],
        summary='Process OAuth authorization code callback',
        description='Exchanges provider authorization code for tokens, resolves user profile, links identity, and returns JWT credentials.',
        request=OAuthCallbackSerializer,
        responses={
            200: OpenApiResponse(description='Successfully authenticated via OAuth'),
            400: OpenApiResponse(description='OAuth token exchange or profile verification failed'),
        }
    )
    def post(self, request, provider):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        redirect_uri = request.data.get('redirect_uri')
        result = OAuthService.handle_callback(
            provider=provider,
            code=serializer.validated_data['code'],
            redirect_uri=redirect_uri,
            request=request
        )
        user_data = UserSerializer(result['user']).data
        return success_response(
            data={
                'access': result['access'],
                'refresh': result['refresh'],
                'session_id': result['session_id'],
                'user': user_data,
            },
            message=f"Successfully authenticated via {provider.title()}."
        )
