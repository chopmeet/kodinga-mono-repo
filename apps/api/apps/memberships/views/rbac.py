from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.communities.selectors.community_selector import CommunitySelector
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.memberships.serializers.member import CommunityMemberSerializer
from common.permissions.base import is_superadmin_user
from common.utils.responses import error_response, success_response


class CommunityRbacView(APIView):
    """
    Overview of community RBAC hierarchy, permissions matrix, and role delegations.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Consulter le RBAC, les rôles et permissions de la communauté",
        responses={200: dict}
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        my_membership = CommunityMember.objects.filter(
            community=community,
            user=request.user,
            status=MembershipStatus.ACTIVE
        ).first()

        is_owner = is_superadmin_user(request.user) or community.owner_id == request.user.id
        is_admin = is_owner or bool(my_membership and my_membership.is_admin)
        is_moderator = is_owner or bool(my_membership and my_membership.is_moderator)
        can_manage_roles = is_owner or is_admin

        effective_role = CommunityRole.OWNER if is_owner else (my_membership.role if my_membership else None)

        settings = getattr(community, 'settings', None)
        if not settings:
            from apps.communities.models.settings import CommunitySettings
            settings, _ = CommunitySettings.objects.get_or_create(community=community)

        if is_owner:
            active_permissions = list(settings.get_role_permissions('owner').keys())
        elif effective_role:
            role_perms = settings.get_role_permissions(effective_role)
            user_overrides = (settings.role_permissions or {}).get('user_overrides', {}).get(str(request.user.id), {})
            combined = dict(role_perms)
            combined.update(user_overrides)
            active_permissions = [k for k, v in combined.items() if v]
        else:
            active_permissions = []

        roles_catalog = [
            {
                "role": CommunityRole.OWNER,
                "label": "Propriétaire / Créateur",
                "description": "Contrôle souverain de l'espace, facturation, transfert de propriété, gestion & délégation totale des rôles.",
                "permissions": [
                    "manage_community_settings",
                    "manage_roles",
                    "delegate_role_assignment",
                    "manage_classroom",
                    "manage_posts_and_categories",
                    "moderate_all_members",
                    "manage_billing",
                    "delete_community"
                ]
            },
            {
                "role": CommunityRole.ADMIN,
                "label": "Administrateur",
                "description": "Gestion pédagogique (cours, leçons), modération générale, gestion des canaux de discussion.",
                "permissions": [
                    "manage_classroom",
                    "manage_posts_and_categories",
                    "moderate_members",
                    "invite_members",
                    "view_audit_logs"
                ]
            },
            {
                "role": CommunityRole.MODERATOR,
                "label": "Modérateur",
                "description": "Modération des publications et commentaires, application de sanctions et validation des adhésions.",
                "permissions": [
                    "moderate_posts_and_comments",
                    "sanction_members",
                    "approve_pending_members"
                ]
            },
            {
                "role": CommunityRole.MEMBER,
                "label": "Membre",
                "description": "Accès aux cours et formations, suivi de progression, publications et échanges communautaires.",
                "permissions": [
                    "view_published_courses",
                    "track_learning_progress",
                    "create_posts",
                    "create_comments",
                    "react_and_vote"
                ]
            }
        ]

        privileged_members = CommunityMember.objects.filter(
            community=community,
            status=MembershipStatus.ACTIVE,
            role__in=[CommunityRole.OWNER, CommunityRole.ADMIN, CommunityRole.MODERATOR]
        ).select_related('user', 'user__profile')

        return success_response(
            data={
                "community": {
                    "id": str(community.id),
                    "name": community.name,
                    "slug": community.slug,
                    "owner": {
                        "id": str(community.owner.id),
                        "username": community.owner.username
                    }
                },
                "roles_catalog": roles_catalog,
                "my_permissions": {
                    "role": effective_role,
                    "is_owner": bool(is_owner),
                    "is_admin": bool(is_admin),
                    "is_moderator": bool(is_moderator),
                    "can_manage_roles": bool(can_manage_roles),
                    "can_manage_classroom": bool(is_admin),
                    "permissions": active_permissions,
                },
                "privileged_members": CommunityMemberSerializer(privileged_members, many=True, context={'request': request, 'is_manager': is_moderator}).data
            },
            message="RBAC et rôles de la communauté récupérés avec succès."
        )
