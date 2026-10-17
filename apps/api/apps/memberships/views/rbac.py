from django.db import models
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from common.utils.responses import success_response, error_response
from apps.communities.selectors.community_selector import CommunitySelector
from apps.memberships.models.member import CommunityMember, CommunityRole, MembershipStatus
from apps.memberships.serializers.member import CommunityMemberSerializer


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

        from common.permissions.base import is_superadmin_user
        is_owner = is_superadmin_user(request.user) or community.owner_id == request.user.id
        is_admin = is_owner or (my_membership and my_membership.is_admin)
        is_moderator = is_owner or (my_membership and my_membership.is_moderator)
        can_manage_roles = is_owner or is_admin


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
        ).select_related('user')

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
                    "role": my_membership.role if my_membership else None,
                    "is_owner": bool(is_owner),
                    "is_admin": bool(is_admin),
                    "is_moderator": bool(is_moderator),
                    "can_manage_roles": bool(can_manage_roles),
                    "can_manage_classroom": bool(is_admin),
                },
                "privileged_members": CommunityMemberSerializer(privileged_members, many=True).data
            },
            message="RBAC et rôles de la communauté récupérés avec succès."
        )
