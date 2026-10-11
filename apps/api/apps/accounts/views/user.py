from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
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


class UserListView(APIView):
    permission_classes = [AllowAny]
    serializer_class = UserSerializer

    @extend_schema(
        tags=['Users'],
        summary='Lister tous les utilisateurs de la plateforme',
        description='Renvoie la liste paginée des utilisateurs avec possibilité de filtrer par recherche textuelle (email, nom, username).',
        responses={200: UserSerializer(many=True)}
    )
    def get(self, request):
        from common.utils.pagination import StandardResultsSetPagination
        from apps.accounts.models.user import User
        from django.db.models import Q

        queryset = User.objects.all().order_by('-date_joined')
        
        search_query = request.query_params.get('search') or request.query_params.get('q')
        if search_query:
            q = search_query.strip()
            queryset = queryset.filter(
                Q(email__icontains=q) |
                Q(username__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q)
            )

        status_param = request.query_params.get('status')
        if status_param == 'active':
            queryset = queryset.filter(is_active=True, email_verified_at__isnull=False)
        elif status_param == 'unverified':
            queryset = queryset.filter(is_active=True, email_verified_at__isnull=True)
        elif status_param == 'inactive':
            queryset = queryset.filter(is_active=False)

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = UserSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
