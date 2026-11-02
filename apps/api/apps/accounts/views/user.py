from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.accounts.models.user import User
from apps.accounts.serializers.user import (
    ConsentSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from apps.accounts.services.consent import ConsentService
from common.permissions import IsPlatformAdmin
from common.permissions.base import is_superadmin_user
from common.utils.responses import error_response, success_response


def build_user_workspace_access(user: User) -> dict:
    """
    Builds the workspace/community access payload used by the 'Ouvrir mon espace' button.
    """
    from apps.communities.selectors.community_selector import CommunitySelector
    from apps.memberships.models.member import (
        CommunityMember,
        CommunityRole,
        MembershipStatus,
    )

    communities = list(CommunitySelector.get_user_communities(user))
    memberships = {
        m.community_id: m
        for m in CommunityMember.objects.filter(
            user=user,
            community_id__in=[c.id for c in communities],
        ).only('community_id', 'role', 'status')
    }

    spaces = []
    owned_count = 0
    primary_space = None

    for comm in communities:
        is_owner = comm.owner_id == user.id or is_superadmin_user(user)
        m = memberships.get(comm.id)
        role = CommunityRole.OWNER if is_owner else (m.role if m else CommunityRole.MEMBER)
        m_status = MembershipStatus.ACTIVE if is_owner else (m.status if m else MembershipStatus.ACTIVE)
        can_manage = role in (CommunityRole.OWNER, CommunityRole.ADMIN, CommunityRole.MODERATOR)
        if comm.owner_id == user.id:
            owned_count += 1

        space_info = {
            "id": str(comm.id),
            "name": comm.name,
            "slug": comm.slug,
            "avatar_url": comm.avatar_url,
            "privacy_type": comm.privacy_type,
            "pricing_type": comm.pricing_type,
            "role": role,
            "status": m_status,
            "is_owner": bool(comm.owner_id == user.id),
            "can_manage": bool(can_manage),
            "url": f"/communities/{comm.slug}",
        }
        spaces.append(space_info)
        if primary_space is None or (comm.owner_id == user.id and not primary_space.get("is_owner")):
            primary_space = space_info

    default_redirect_url = primary_space["url"] if primary_space else "/dashboard"

    return {
        "can_open_workspace": bool(user.is_active),
        "is_pro": bool(user.is_pro),
        "is_superadmin": bool(is_superadmin_user(user)),
        "owned_communities_count": owned_count,
        "joined_communities_count": len(spaces),
        "primary_workspace": primary_space,
        "default_redirect_url": default_redirect_url,
        "workspaces": spaces,
    }


class UserProfileMeView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    @extend_schema(
        tags=['Authentication & Accounts'],
        summary='Retrieve logged-in user profile',
        description='Fetches the complete user profile, verification status, and workspace access summary of the authenticated account.',
        responses={
            200: OpenApiResponse(response=UserSerializer, description='Profile data retrieved'),
            401: OpenApiResponse(description='Authentication required'),
        }
    )
    def get(self, request):
        data = dict(UserSerializer(request.user).data)
        profile = getattr(request.user, 'profile', None)
        data['avatar_url'] = profile.avatar_url if profile else ''
        data['banner_url'] = profile.banner_url if profile else ''
        data['bio'] = profile.bio if profile else ''
        data['headline'] = getattr(profile, 'headline', '') if profile else ''
        data['workspace_access'] = build_user_workspace_access(request.user)
        return success_response(data=data)

    @extend_schema(
        tags=['Authentication & Accounts'],
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
        tags=['Authentication & Accounts'],
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


class UserWorkspaceAccessView(APIView):
    """
    Dedicated endpoint for the 'Ouvrir mon espace' button.
    Returns the authenticated user's workspace access status, primary community,
    and full list of communities with roles and permissions.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Authentication & Accounts', 'Communities & Memberships'],
        summary="Vérifier l'accès à mon espace ('Ouvrir mon espace')",
        description="Renvoie les informations d'accès à l'espace personnel et aux communautés de l'utilisateur connecté.",
        responses={200: dict}
    )
    def get(self, request):
        if not request.user.is_active:
            return error_response(
                "Votre compte est désactivé.",
                status_code=status.HTTP_403_FORBIDDEN
            )
        access_data = build_user_workspace_access(request.user)
        return success_response(
            data=access_data,
            message="Accès à l'espace utilisateur vérifié avec succès."
        )


class UserConsentView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConsentSerializer

    @extend_schema(
        tags=['Authentication & Accounts'],
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
        tags=['Authentication & Accounts'],
        summary='Lister tous les utilisateurs de la plateforme (Admin)',
        description='Renvoie la liste paginée des utilisateurs avec possibilité de filtrer par recherche textuelle (email, nom, username). Nécessite des droits administrateur.',
        responses={
            200: UserSerializer(many=True),
            401: OpenApiResponse(description='Authentification requise'),
            403: OpenApiResponse(description='Accès refusé - Droits administrateur requis'),
        }
    )
    def get(self, request):
        from django.db.models import Q

        from common.utils.pagination import StandardResultsSetPagination

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
        tags=['Authentication & Accounts'],
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
        tags=['Authentication & Accounts'],
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
