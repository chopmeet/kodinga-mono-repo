from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from common.permissions import IsPlatformAdmin
from common.utils.responses import error_response, success_response
from apps.accounts.models.user import User
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
        summary='Update profile details (partial)',
        description='Updates personal details such as first name, last name, language, or timezone.',
        request=UserUpdateSerializer,
        responses={
            200: OpenApiResponse(response=UserSerializer, description='Profile updated successfully'),
            400: OpenApiResponse(description='Validation error'),
            401: OpenApiResponse(description='Authentication required'),
        }
    )
    def patch(self, request):
        serializer = UserUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(
            data=UserSerializer(request.user).data,
            message="User profile updated successfully."
        )

    @extend_schema(
        tags=['Users'],
        summary='Update profile details (full)',
        description='Replaces profile details with the provided payload.',
        request=UserUpdateSerializer,
        responses={
            200: OpenApiResponse(response=UserSerializer, description='Profile updated successfully'),
            400: OpenApiResponse(description='Validation error'),
            401: OpenApiResponse(description='Authentication required'),
        }
    )
    def put(self, request):
        serializer = UserUpdateSerializer(
            request.user,
            data=request.data,
            partial=False,
            context={'request': request}
        )
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
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    serializer_class = UserSerializer

    @extend_schema(
        tags=['Users'],
        summary='Lister tous les utilisateurs de la plateforme (Admin)',
        description='Renvoie la liste paginée des utilisateurs avec possibilité de filtrer par recherche textuelle (email, nom, username). Nécessite des droits administrateur.',
        responses={
            200: UserSerializer(many=True),
            401: OpenApiResponse(description='Authentification requise'),
            403: OpenApiResponse(description='Accès refusé - Droits administrateur requis'),
        }
    )
    def get(self, request):
        from common.utils.pagination import StandardResultsSetPagination
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


class UserDetailAdminView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]
    serializer_class = UserSerializer

    @extend_schema(
        tags=['Users'],
        summary='Détails utilisateur par ID (Admin)',
        description='Consulte les détails complets d\'un compte utilisateur.',
        responses={
            200: UserSerializer,
            404: OpenApiResponse(description='Utilisateur introuvable'),
        }
    )
    def get(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return error_response("Utilisateur introuvable.", status_code=status.HTTP_404_NOT_FOUND)
        return success_response(data=UserSerializer(target_user).data)

    @extend_schema(
        tags=['Users'],
        summary='Modifier un utilisateur (Admin)',
        description='Modifie les attributs d\'un utilisateur (is_superadmin, is_active, etc.).',
        request=UserUpdateSerializer,
        responses={
            200: UserSerializer,
            400: OpenApiResponse(description='Données invalides'),
            404: OpenApiResponse(description='Utilisateur introuvable'),
        }
    )
    def patch(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return error_response("Utilisateur introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = UserUpdateSerializer(
            target_user,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(
            data=UserSerializer(target_user).data,
            message="Utilisateur mis à jour avec succès."
        )

    def put(self, request, user_id):
        return self.patch(request, user_id)

