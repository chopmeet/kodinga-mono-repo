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
        description=(
            'Renvoie la liste paginée des utilisateurs avec possibilité de filtrer par recherche textuelle (email, nom, username), '
            'par statut (active, unverified, inactive), par rôle fonctionnel (creator, member, admin), et par date d\'inscription '
            '(périodes: 7d, 30d, 90d ou dates date_from / date_to).'
        ),
        responses={
            200: UserSerializer(many=True),
            401: OpenApiResponse(description='Authentification requise'),
            403: OpenApiResponse(description='Accès refusé - Droits administrateur requis'),
        }
    )
    def get(self, request):
        from datetime import timedelta

        from django.db.models import Count, Q
        from django.utils import timezone as django_timezone

        from common.utils.pagination import StandardResultsSetPagination

        queryset = User.objects.annotate(
            communities_created_count=Count('owned_communities', distinct=True)
        ).order_by('-date_joined')
        
        # 1. Text search
        search_query = request.query_params.get('search') or request.query_params.get('q')
        if search_query:
            q = search_query.strip()
            queryset = queryset.filter(
                Q(email__icontains=q) |
                Q(username__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q)
            )

        # 2. Status filter
        status_param = request.query_params.get('status')
        if status_param == 'active':
            queryset = queryset.filter(is_active=True, email_verified_at__isnull=False)
        elif status_param == 'unverified':
            queryset = queryset.filter(is_active=True, email_verified_at__isnull=True)
        elif status_param == 'inactive':
            queryset = queryset.filter(is_active=False)

        # 3. Role / Functional type filter: creator, member, admin
        role_param = request.query_params.get('role') or request.query_params.get('account_type')
        if role_param:
            role_param = role_param.lower().strip()
            if role_param in ['creator', 'creators', 'créateur', 'créateurs']:
                queryset = queryset.filter(communities_created_count__gt=0)
            elif role_param in ['member', 'members', 'membre', 'membres']:
                queryset = queryset.filter(
                    communities_created_count=0,
                    is_superadmin=False,
                    is_superuser=False,
                )
            elif role_param in ['admin', 'admins', 'superadmin', 'administrateur', 'administrateurs']:
                queryset = queryset.filter(
                    Q(is_superadmin=True) | Q(is_superuser=True)
                )

        # 4. Registration date filters (period presets: 7d, 30d, 90d or explicit date range)
        now = django_timezone.now()
        period_param = request.query_params.get('period')
        if period_param:
            period_param = period_param.lower().strip()
            if period_param in ['7d', '7j', '7']:
                queryset = queryset.filter(date_joined__gte=now - timedelta(days=7))
            elif period_param in ['30d', '30j', '30']:
                queryset = queryset.filter(date_joined__gte=now - timedelta(days=30))
            elif period_param in ['90d', '90j', '90']:
                queryset = queryset.filter(date_joined__gte=now - timedelta(days=90))

        date_from = request.query_params.get('date_from') or request.query_params.get('created_from')
        if date_from:
            queryset = queryset.filter(date_joined__date__gte=date_from)

        date_to = request.query_params.get('date_to') or request.query_params.get('created_to')
        if date_to:
            queryset = queryset.filter(date_joined__date__lte=date_to)

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = UserSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AdminUsersKPIsView(APIView):
    """
    Returns global aggregate KPIs for the superadmin dashboard regarding platform users:
    - creators_count: users who have created at least one community
    - members_count: users who have created zero communities
    - admins_count: superadmins
    - new_users_7d, new_users_30d, new_users_90d
    - total_users, unverified_users, active_users, suspended_users
    """

    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    @extend_schema(
        tags=['Authentication & Accounts'],
        summary='KPIs et indicateurs utilisateurs (Admin)',
        description='Renvoie les statistiques globales des utilisateurs de la plateforme (créateurs, membres, administrateurs, nouvelles inscriptions sur 7j, 30j, 90j).',
        responses={200: OpenApiResponse(description='Statistiques globales utilisateurs')},
    )
    def get(self, request):
        from datetime import timedelta

        from django.db.models import Count, Q
        from django.utils import timezone as django_timezone

        now = django_timezone.now()
        total_users = User.objects.count()

        # Users who have created at least 1 community
        creators_count = (
            User.objects.annotate(comm_count=Count('owned_communities', distinct=True))
            .filter(comm_count__gt=0)
            .count()
        )

        admins_count = User.objects.filter(
            Q(is_superadmin=True) | Q(is_superuser=True)
        ).count()

        # Members who created 0 communities and are not admins
        members_count = (
            User.objects.annotate(comm_count=Count('owned_communities', distinct=True))
            .filter(comm_count=0, is_superadmin=False, is_superuser=False)
            .count()
        )

        active_users_count = User.objects.filter(
            is_active=True, email_verified_at__isnull=False
        ).count()

        unverified_users_count = User.objects.filter(
            is_active=True, email_verified_at__isnull=True
        ).count()

        suspended_users_count = User.objects.filter(is_active=False).count()

        new_users_7d = User.objects.filter(date_joined__gte=now - timedelta(days=7)).count()
        new_users_30d = User.objects.filter(date_joined__gte=now - timedelta(days=30)).count()
        new_users_90d = User.objects.filter(date_joined__gte=now - timedelta(days=90)).count()

        kpi_data = {
            "total_users": total_users,
            "creators_count": creators_count,
            "members_count": members_count,
            "admins_count": admins_count,
            "active_users_count": active_users_count,
            "unverified_users_count": unverified_users_count,
            "suspended_users_count": suspended_users_count,
            "new_users_7d": new_users_7d,
            "new_users_30d": new_users_30d,
            "new_users_90d": new_users_90d,
        }

        return success_response(data=kpi_data)


class AdminVerifyUserEmailView(APIView):
    """
    Allows a superadmin to manually verify a user's email address without requiring the user
    to click on an activation link.
    """

    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    @extend_schema(
        tags=['Authentication & Accounts'],
        summary='Valider manuellement l\'email d\'un utilisateur (Admin)',
        description='Marque immédiatement l\'adresse email de l\'utilisateur ciblé comme vérifiée.',
        responses={
            200: UserSerializer,
            404: OpenApiResponse(description='Utilisateur introuvable'),
        }
    )
    def post(self, request, user_id):
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return error_response(
                message="Utilisateur introuvable.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        target_user.mark_email_verified()

        # Audit log if available
        try:
            from apps.administration.services.admin_service import AdministrationService
            AdministrationService.log_action(
                actor=request.user,
                action="user.verify_email",
                target_model="User",
                target_id=str(target_user.id),
                details=f"Email {target_user.email} vérifié manuellement par le superadmin {request.user.username}.",
            )
        except Exception:
            pass

        return success_response(
            data=UserSerializer(target_user).data,
            message=f"L'adresse email de {target_user.get_full_name()} ({target_user.email}) a été marquée comme vérifiée avec succès."
        )


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
