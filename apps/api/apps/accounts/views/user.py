from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from common.utils.responses import success_response
from apps.accounts.serializers.user import ConsentSerializer, UserSerializer, UserUpdateSerializer
from apps.accounts.services.consent import ConsentService


class UserProfileMeView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    @extend_schema(
        tags=['Users'],
        summary='Retrieve logged-in user profile',
        description='Fetches the complete user profile and verification status of the authenticated account.',
        responses={
            200: OpenApiResponse(response=UserSerializer, description='Profile data retrieved'),
            401: OpenApiResponse(description='Authentication required'),
        }
    )
    def get(self, request):
        serializer = UserSerializer(request.user)
        return success_response(data=serializer.data)

    @extend_schema(
        tags=['Users'],
        summary='Update profile details',
        description='Updates personal details such as first name, last name, language, or timezone.',
        request=UserUpdateSerializer,
        responses={
            200: OpenApiResponse(response=UserSerializer, description='Profile updated successfully'),
            400: OpenApiResponse(description='Validation error'),
            401: OpenApiResponse(description='Authentication required'),
        }
    )
    def patch(self, request):
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(
            data=UserSerializer(request.user).data,
            message="User profile updated successfully."
        )


class UserConsentView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConsentSerializer

    @extend_schema(
        tags=['Users'],
        summary='Record user legal consent',
        description='Logs explicit user consent for GDPR, Terms of Service, or privacy policy updates.',
        request=ConsentSerializer,
        responses={
            201: OpenApiResponse(response=ConsentSerializer, description='Consent recorded successfully'),
            400: OpenApiResponse(description='Validation error'),
            401: OpenApiResponse(description='Authentication required'),
        }
    )
    def post(self, request):
        serializer = ConsentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        consent = ConsentService.record_consent(
            user=request.user,
            consent_type=serializer.validated_data['consent_type'],
            policy_version=serializer.validated_data.get('policy_version', '1.0'),
            granted=serializer.validated_data.get('granted', True)
        )
        return success_response(
            data=ConsentSerializer(consent).data,
            message="Consent successfully recorded.",
            status_code=status.HTTP_201_CREATED
        )
