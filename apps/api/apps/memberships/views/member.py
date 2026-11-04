from django.db import models, transaction
from django.db.models import F
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.administration.models.audit import PlatformAuditLog
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.communities.selectors.community_selector import CommunitySelector
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.memberships.permissions import (
    check_last_admin_protection,
    has_community_permission,
    is_active_community_member,
    is_superadmin_user,
)
from apps.memberships.selectors.membership_selector import MembershipSelector
from apps.memberships.serializers.member import (
    CommunityMemberRoleUpdateSerializer,
    CommunityMemberSerializer,
    MemberModerationDecisionSerializer,
)
from apps.memberships.serializers.sanction import (
    CreateSanctionRequestSerializer,
    MemberSanctionSerializer,
)
from apps.memberships.services.invitation_service import ROLE_MAPPING
from apps.memberships.services.membership_service import MembershipService
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response


class JoinCommunityView(APIView):
    """
    Join a public community or request approval for a private community.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Rejoindre un espace communautaire",
        request=None,
        parameters=[
            OpenApiParameter(name='invite_code', description="Code d'invitation optionnel", required=False, type=str)
        ],
        responses={200: CommunityMemberSerializer}
    )
    def post(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        invite_code = request.query_params.get('invite_code') or request.data.get('invite_code')
        member = MembershipService.join_community(request.user, community, invite_code)

        msg = "Bienvenue dans la communauté !" if member.status == 'active' else "Votre demande d'adhésion a été transmise aux modérateurs."
        return success_response(
            data=CommunityMemberSerializer(member).data,
            message=msg,
            status_code=status.HTTP_200_OK
        )


class LeaveCommunityView(APIView):
    """
    Leave a community.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Quitter un espace communautaire",
        request=None,
        responses={200: None}
    )
    def post(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        MembershipService.leave_community(request.user, community)
        return success_response(message="Vous avez quitté la communauté avec succès.")


class MyMembershipView(APIView):
    """
    Get authenticated user's membership details and permissions in a community.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Consulter son statut d'adhésion et ses permissions dans la communauté",
        responses={200: CommunityMemberSerializer}
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        member = MembershipSelector.get_member(community, request.user)
        if not member and community.owner_id == request.user.id:
            member, _ = CommunityMember.objects.get_or_create(
                community=community,
                user=request.user,
                defaults={
                    'role': CommunityRole.OWNER,
                    'status': MembershipStatus.ACTIVE,
                }
            )

        if not member:
            if is_superadmin_user(request.user):
                settings = getattr(community, 'settings', None)
                if not settings:
                    from apps.communities.models.settings import CommunitySettings
                    settings, _ = CommunitySettings.objects.get_or_create(community=community)
                return success_response(
                    data={
                        'id': None,
                        'user': CommunityMemberSerializer().get_user(type('Obj', (), {'user': request.user})()),
                        'role': CommunityRole.OWNER,
                        'status': MembershipStatus.ACTIVE,
                        'is_owner': True,
                        'is_admin': True,
                        'is_moderator': True,
                        'can_manage': True,
                        'permissions': list(settings.get_role_permissions('owner').keys()),
                    }
                )
            return success_response(None, message="Non membre.")

        data = CommunityMemberSerializer(member, context={'request': request, 'is_manager': True}).data
        is_owner = community.owner_id == request.user.id or is_superadmin_user(request.user) or member.role == CommunityRole.OWNER
        is_admin = is_owner or member.is_admin
        is_moderator = is_owner or member.is_moderator
        settings = getattr(community, 'settings', None)
        if not settings:
            from apps.communities.models.settings import CommunitySettings
            settings, _ = CommunitySettings.objects.get_or_create(community=community)

        if is_owner:
            active_permissions = list(settings.get_role_permissions('owner').keys())
        elif member.status == MembershipStatus.ACTIVE:
            role_perms = settings.get_role_permissions(member.role)
            user_overrides = (settings.role_permissions or {}).get('user_overrides', {}).get(str(request.user.id), {})
            combined = dict(role_perms)
            combined.update(user_overrides)
            active_permissions = [k for k, v in combined.items() if v]
        else:
            active_permissions = []

        data['is_owner'] = bool(is_owner)
        data['is_admin'] = bool(is_admin and member.status == MembershipStatus.ACTIVE)
        data['is_moderator'] = bool(is_moderator and member.status == MembershipStatus.ACTIVE)
        data['can_manage'] = bool((is_owner or is_moderator) and member.status == MembershipStatus.ACTIVE)
        data['permissions'] = active_permissions
        data['notifications_enabled'] = member.notifications_enabled

        return success_response(data=data)


class CommunityMemberListView(APIView):
    """
    List members of a community with filters and search.
    - Community managers (owner, admin, moderator, platform admin) can view all members and filter by any status (active, pending, banned, etc.).
    - Active community members can view the active members directory with safe public user fields.
    """
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Lister les membres d'une communauté",
        description="Renvoie la liste paginée des membres d'une communauté. Les gestionnaires ont accès à tous les statuts ; les membres réguliers consultent l'annuaire des membres actifs.",
        parameters=[
            OpenApiParameter(name='role', description="Filtrer par rôle (owner, admin, moderator, member)", required=False, type=str),
            OpenApiParameter(name='status', description="Statut (active, pending, banned, all...)", required=False, type=str),
            OpenApiParameter(name='search', description="Recherche par pseudo, nom ou titre", required=False, type=str),
            OpenApiParameter(name='ordering', description="Tri (joined_at, -joined_at, reputation, username)", required=False, type=str),
        ],
        responses={200: CommunityMemberSerializer(many=True)}
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        is_platform_admin = is_superadmin_user(request.user)
        is_owner = (community.owner_id == request.user.id)
        current_membership = MembershipSelector.get_member(community, request.user)
        is_active_member = is_active_community_member(request.user, community)
        has_mgr_permission = bool(
            (current_membership and current_membership.status == MembershipStatus.ACTIVE and current_membership.role in [CommunityRole.OWNER, CommunityRole.ADMIN, CommunityRole.MODERATOR])
            or has_community_permission(request.user, community, 'can_review_requests')
            or has_community_permission(request.user, community, 'can_ban_members')
        )
        is_manager = is_platform_admin or is_owner or has_mgr_permission

        if not (is_manager or is_active_member):
            return error_response(
                "Vous devez être membre actif de cette communauté pour consulter l'annuaire des membres.",
                status_code=status.HTTP_403_FORBIDDEN
            )

        role = request.query_params.get('role')
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search') or request.query_params.get('q')
        ordering = request.query_params.get('ordering')

        # Non-managers can only see active members
        if not is_manager:
            status_filter = MembershipStatus.ACTIVE

        queryset = MembershipSelector.list_community_members(
            community=community,
            role=role,
            status=status_filter,
            search=search,
            is_manager=is_manager,
            ordering=ordering,
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = CommunityMemberSerializer(
            page,
            many=True,
            context={'request': request, 'is_manager': is_manager}
        )
        return paginator.get_paginated_response(serializer.data)


class CommunityMemberDetailView(APIView):
    """
    Retrieve, update member role, custom title, or approve/reject pending member.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Consulter les détails d'un membre",
        description="Récupère les informations détaillées, le rôle et le statut d'adhésion d'un membre spécifique.",
        parameters=[
            OpenApiParameter(name='member_id', description="UUID du membre", required=True, type=str, location=OpenApiParameter.PATH),
        ],
        responses={200: CommunityMemberSerializer}
    )
    def get(self, request, slug, member_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            member = CommunityMember.objects.select_related('user', 'user__profile').get(
                models.Q(id=member_id) | models.Q(user_id=member_id),
                community=community
            )
        except Exception:
            return error_response("Membre introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        is_platform_admin = is_superadmin_user(request.user)
        is_owner = (community.owner_id == request.user.id)
        current_membership = MembershipSelector.get_member(community, request.user)
        is_active_member = is_active_community_member(request.user, community)
        is_manager = is_platform_admin or is_owner or (
            current_membership
            and current_membership.status == MembershipStatus.ACTIVE
            and current_membership.role in [CommunityRole.OWNER, CommunityRole.ADMIN, CommunityRole.MODERATOR]
        )

        is_private_or_paid = (
            community.privacy_type in [CommunityPrivacy.PRIVATE, CommunityPrivacy.SECRET]
            or community.pricing_type == CommunityPricing.PAID
        )
        if is_private_or_paid and not (is_manager or is_active_member):
            return error_response(
                "Cette communauté est privée. Vous devez être membre pour consulter ce profil.",
                status_code=status.HTTP_403_FORBIDDEN
            )

        if not is_manager and member.status != MembershipStatus.ACTIVE and member.user_id != request.user.id:
            return error_response("Membre introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        return success_response(
            data=CommunityMemberSerializer(
                member,
                context={'request': request, 'is_manager': is_manager or request.user.id == member.user_id}
            ).data
        )

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Modifier le rôle ou le titre d'un membre",
        request=CommunityMemberRoleUpdateSerializer,
        responses={200: CommunityMemberSerializer}
    )
    def patch(self, request, slug, member_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            member = CommunityMember.objects.get(id=member_id, community=community)
        except Exception:
            return error_response("Membre introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = CommunityMemberRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = MembershipService.change_member_role(
            actor_user=request.user,
            member=member,
            new_role=serializer.validated_data['role']
        )
        if 'custom_title' in serializer.validated_data:
            updated.custom_title = serializer.validated_data['custom_title']
            updated.save(update_fields=['custom_title', 'updated_at'])

        return success_response(
            data=CommunityMemberSerializer(updated).data,
            message="Rôle du membre mis à jour."
        )

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Valider ou refuser une demande d'adhésion",
        request=MemberModerationDecisionSerializer,
        responses={200: CommunityMemberSerializer}
    )
    def put(self, request, slug, member_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            member = CommunityMember.objects.get(id=member_id, community=community)
        except Exception:
            return error_response("Membre introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = MemberModerationDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        decided = MembershipService.approve_or_reject_member(
            actor_user=request.user,
            member=member,
            approve=serializer.validated_data['approve']
        )
        return success_response(
            data=CommunityMemberSerializer(decided).data,
            message="Demande d'adhésion traitée."
        )


class MemberSanctionsView(APIView):
    """
    Apply moderation sanctions (ban, mute, warning) to a member.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Appliquer une sanction de modération à un membre",
        request=CreateSanctionRequestSerializer,
        responses={201: MemberSanctionSerializer}
    )
    def post(self, request, slug, member_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            member = CommunityMember.objects.get(id=member_id, community=community)
        except Exception:
            return error_response("Membre introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = CreateSanctionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        sanction = MembershipService.sanction_member(
            actor_user=request.user,
            member=member,
            sanction_type=data['sanction_type'],
            reason=data['reason'],
            duration_days=data.get('duration_days')
        )
        return success_response(
            data=MemberSanctionSerializer(sanction).data,
            message=f"Sanction '{sanction.sanction_type}' appliquée.",
            status_code=status.HTTP_201_CREATED
        )


class WorkspaceMembersListView(CommunityMemberListView):
    """
    List members of a workspace. Supports lookup by workspace UUID or slug.
    """
    @extend_schema(
        tags=['Communities & Workspaces', 'Workspaces & Members'],
        summary="Lister les membres d'un espace",
        description="Renvoie la liste paginée des membres d'un espace avec leurs rôles et statuts.",
        parameters=[
            OpenApiParameter(name='role', description="Filtrer par rôle", required=False, type=str),
            OpenApiParameter(name='search', description="Recherche par pseudo, nom ou email", required=False, type=str),
        ],
        responses={200: CommunityMemberSerializer(many=True)}
    )
    def get(self, request, workspace_id):
        return super().get(request, slug=workspace_id)


class WorkspaceMemberDetailView(APIView):
    """
    Manage an individual workspace collaborator:
    - PATCH: Update member role (Admin only, with last admin protection).
    - DELETE: Remove a member (Admin) or leave the workspace (Self-service, with last admin protection).
    """
    permission_classes = [IsAuthenticated]

    def _resolve_context(self, request, workspace_id, user_id):
        try:
            workspace = CommunitySelector.get_community_by_slug(workspace_id, user=request.user)
        except Exception:
            return None, None

        # Resolve member by user UUID or membership UUID
        member = CommunityMember.objects.select_related('user', 'user__profile').filter(
            community=workspace
        ).filter(
            models.Q(user_id=user_id) | models.Q(id=user_id)
        ).first()

        return workspace, member

    @extend_schema(
        tags=['Communities & Workspaces', 'Workspaces & Members'],
        summary="Modifier le rôle d'un membre (Admin)",
        description="Change le rôle d'un collaborateur dans l'espace. Empêche la rétrogradation du dernier administrateur.",
        request=CommunityMemberRoleUpdateSerializer,
        responses={200: CommunityMemberSerializer}
    )
    def patch(self, request, workspace_id, user_id):
        workspace, member = self._resolve_context(request, workspace_id, user_id)
        if not workspace:
            return error_response("Espace introuvable.", status_code=status.HTTP_404_NOT_FOUND)
        if not member:
            return error_response("Membre introuvable dans cet espace.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = CommunityMemberRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_role = serializer.validated_data['role'].lower()
        if target_role in ROLE_MAPPING:
            target_role = ROLE_MAPPING[target_role]

        # Check last admin protection if demoting
        if member.role in [CommunityRole.OWNER, CommunityRole.ADMIN] and target_role not in [CommunityRole.OWNER, CommunityRole.ADMIN]:
            check_last_admin_protection(workspace, member.user_id)

        updated = MembershipService.change_member_role(
            actor_user=request.user,
            member=member,
            new_role=target_role
        )
        if 'custom_title' in serializer.validated_data:
            updated.custom_title = serializer.validated_data['custom_title']
            updated.save(update_fields=['custom_title', 'updated_at'])

        PlatformAuditLog.objects.create(
            actor=request.user,
            action='workspace.member_role_changed',
            target_type='community_member',
            target_id=str(updated.id),
            details={
                'workspace_id': str(workspace.id),
                'target_user_id': str(member.user_id),
                'new_role': target_role,
            },
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:255]
        )

        return success_response(
            data=CommunityMemberSerializer(updated).data,
            message="Rôle du membre mis à jour avec succès."
        )

    @extend_schema(
        tags=['Communities & Workspaces', 'Workspaces & Members'],
        summary="Retirer un membre ou quitter l'espace",
        description="Permet à un administrateur d'exclure un collaborateur ou à un utilisateur de quitter l'espace lui-même. Empêche le départ ou le retrait du dernier administrateur.",
        request=None,
        responses={200: None}
    )
    def delete(self, request, workspace_id, user_id):
        workspace, member = self._resolve_context(request, workspace_id, user_id)
        if not workspace:
            return error_response("Espace introuvable.", status_code=status.HTTP_404_NOT_FOUND)
        if not member:
            return error_response("Membre introuvable dans cet espace.", status_code=status.HTTP_404_NOT_FOUND)

        is_self = (request.user.id == member.user_id)
        actor_membership = MembershipSelector.get_member(workspace, request.user)
        is_admin_actor = is_superadmin_user(request.user) or workspace.owner_id == request.user.id or (actor_membership and actor_membership.is_admin)

        if not is_self and not is_admin_actor:
            return error_response("Droits administrateur requis pour retirer un collaborateur.", status_code=status.HTTP_403_FORBIDDEN)

        # Cannot remove or leave if last admin
        check_last_admin_protection(workspace, member.user_id)

        # Owner cannot leave without transferring ownership
        if member.role == CommunityRole.OWNER:
            return error_response("Le propriétaire ne peut pas quitter l'espace sans transférer la propriété au préalable.", status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)

        with transaction.atomic():
            was_active = member.status == MembershipStatus.ACTIVE
            member.status = MembershipStatus.LEFT
            member.save(update_fields=['status', 'updated_at'])
            if was_active:
                Community.objects.filter(id=workspace.id, members_count__gt=0).update(
                    members_count=F('members_count') - 1
                )

            PlatformAuditLog.objects.create(
                actor=request.user,
                action='workspace.member_removed' if not is_self else 'workspace.member_left',
                target_type='community_member',
                target_id=str(member.id),
                details={
                    'workspace_id': str(workspace.id),
                    'target_user_id': str(member.user_id),
                    'is_self_departure': is_self,
                },
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:255]
            )

        msg = "Vous avez quitté l'espace avec succès." if is_self else "Le collaborateur a été retiré de l'espace."
        return success_response(message=msg)


class CommunityNotificationToggleView(APIView):
    """
    Activer, désactiver ou consulter les notifications d'une communauté (cloche).
    POST /api/v1/communities/<slug>/notifications/toggle/
    POST /api/v1/communities/<slug>/notifications/
    GET /api/v1/communities/<slug>/notifications/
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Consulter l'état des notifications pour une communauté",
        responses={200: CommunityMemberSerializer}
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        member = CommunityMember.objects.filter(community=community, user=request.user).first()
        enabled = member.notifications_enabled if member else False
        return success_response(
            data={
                "community_id": str(community.id),
                "community_slug": community.slug,
                "notifications_enabled": enabled,
                "is_member": bool(member and member.status == MembershipStatus.ACTIVE),
            }
        )

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Basculer l'état des notifications pour une communauté (cloche)",
        responses={200: CommunityMemberSerializer}
    )
    def post(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        member = CommunityMember.objects.filter(community=community, user=request.user).first()
        requested_val = None
        if isinstance(request.data, dict):
            requested_val = request.data.get("notifications_enabled")
            if requested_val is None:
                requested_val = request.data.get("enabled")

        if not member:
            if community.privacy_type == CommunityPrivacy.PUBLIC and community.pricing_type == CommunityPricing.FREE:
                new_val = bool(requested_val) if requested_val is not None else True
                member = CommunityMember.objects.create(
                    community=community,
                    user=request.user,
                    role=CommunityRole.MEMBER,
                    status=MembershipStatus.ACTIVE,
                    notifications_enabled=new_val,
                )
                Community.objects.filter(id=community.id).update(members_count=F('members_count') + 1)
            else:
                return error_response(
                    "Vous devez être membre de cette communauté pour gérer les notifications.",
                    status_code=status.HTTP_403_FORBIDDEN
                )
        else:
            if requested_val is not None:
                member.notifications_enabled = bool(requested_val)
            else:
                member.notifications_enabled = not member.notifications_enabled
            member.save(update_fields=['notifications_enabled', 'updated_at'])

        msg = "Notifications activées." if member.notifications_enabled else "Notifications désactivées."
        return success_response(
            data={
                "community_id": str(community.id),
                "community_slug": community.slug,
                "notifications_enabled": member.notifications_enabled,
                "is_member": member.status == MembershipStatus.ACTIVE,
            },
            message=msg,
        )
