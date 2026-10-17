from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import success_response, error_response
from apps.communities.models.community import CommunityPrivacy, CommunityPricing
from apps.communities.selectors.community_selector import CommunitySelector
from apps.memberships.models.member import CommunityMember, CommunityRole, MembershipStatus
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
from apps.memberships.services.membership_service import MembershipService


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
    Get authenticated user's membership details in a community.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Consulter son statut d'adhésion dans la communauté",
        responses={200: CommunityMemberSerializer}
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        member = MembershipSelector.get_member(community, request.user)
        if not member:
            return success_response(None, message="Non membre.")

        return success_response(data=CommunityMemberSerializer(member).data)


class CommunityMemberListView(APIView):
    """
    List members of a community with filters and search.
    - Community managers (owner, admin, moderator, platform admin) can view all members and filter by any status (active, pending, banned, etc.).
    - Community members (or public visitors for public communities) can view the active members directory.
    """
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Lister les membres d'une communauté",
        description="Renvoie la liste des membres d'une communauté avec leurs rôles (owner, admin, moderator, member) et statuts (active, pending, banned...). Réservé aux gestionnaires de la communauté (owner, admin, modérateur) et administrateurs de la plateforme.",
        parameters=[
            OpenApiParameter(name='role', description="Filtrer par rôle (owner, admin, moderator, member)", required=False, type=str),
            OpenApiParameter(name='status', description="Statut (active, pending, banned, all...)", required=False, type=str),
            OpenApiParameter(name='search', description="Recherche par pseudo, nom ou email", required=False, type=str),
        ],
        responses={200: CommunityMemberSerializer(many=True)}
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        is_platform_admin = bool(
            getattr(request.user, 'is_superadmin', False) or
            getattr(request.user, 'is_superuser', False) or
            getattr(request.user, 'is_staff', False)
        )
        is_owner = (community.owner_id == request.user.id)
        current_membership = MembershipSelector.get_member(community, request.user)
        is_active_member = bool(current_membership and current_membership.status == MembershipStatus.ACTIVE)
        has_community_permission = bool(
            is_active_member and
            current_membership.role in [CommunityRole.OWNER, CommunityRole.ADMIN, CommunityRole.MODERATOR]
        )
        is_manager = is_platform_admin or is_owner or has_community_permission

        if not is_manager:
            return error_response(
                "Vous devez être propriétaire, administrateur ou modérateur de la communauté pour consulter la liste des membres.",
                status_code=status.HTTP_403_FORBIDDEN
            )

        role = request.query_params.get('role')
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search')

        # Non-managers can only see active members
        if not is_manager:
            status_filter = MembershipStatus.ACTIVE

        queryset = MembershipSelector.list_community_members(
            community=community,
            role=role,
            status=status_filter,
            search=search,
            is_manager=is_manager,
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = CommunityMemberSerializer(page, many=True)
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
            member = CommunityMember.objects.select_related('user', 'user__profile').get(id=member_id, community=community)
        except Exception:
            return error_response("Membre introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        is_platform_admin = bool(
            getattr(request.user, 'is_superadmin', False) or
            getattr(request.user, 'is_superuser', False) or
            getattr(request.user, 'is_staff', False)
        )
        is_owner = (community.owner_id == request.user.id)
        current_membership = MembershipSelector.get_member(community, request.user)
        is_active_member = bool(current_membership and current_membership.status == MembershipStatus.ACTIVE)
        is_manager = is_platform_admin or is_owner or (is_active_member and current_membership.role in [CommunityRole.OWNER, CommunityRole.ADMIN, CommunityRole.MODERATOR])

        is_private_or_paid = (
            community.privacy_type in [CommunityPrivacy.PRIVATE, CommunityPrivacy.SECRET]
            or community.pricing_type == CommunityPricing.PAID
        )
        if is_private_or_paid and not (is_manager or is_active_member):
            return error_response(
                "Cette communauté est privée. Vous devez être membre pour consulter ce profil.",
                status_code=status.HTTP_403_FORBIDDEN
            )

        return success_response(data=CommunityMemberSerializer(member).data)

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
