from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import success_response, error_response
from apps.communities.selectors.community_selector import CommunitySelector
from apps.memberships.models.member import CommunityMember
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
        tags=['Memberships'],
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
        tags=['Memberships'],
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
        tags=['Memberships'],
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
    """
    permission_classes = [AllowAny]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=['Memberships'],
        summary="Lister les membres d'une communauté",
        parameters=[
            OpenApiParameter(name='role', description="Filtrer par rôle (owner, admin, moderator, member)", required=False, type=str),
            OpenApiParameter(name='status', description="Statut (active, pending, banned...)", required=False, type=str),
            OpenApiParameter(name='search', description="Recherche par pseudo ou nom", required=False, type=str),
        ],
        responses={200: CommunityMemberSerializer(many=True)}
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        role = request.query_params.get('role')
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search')

        queryset = MembershipSelector.list_community_members(
            community=community,
            role=role,
            status=status_filter,
            search=search
        )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = CommunityMemberSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class CommunityMemberDetailView(APIView):
    """
    Update member role, custom title, or approve/reject pending member.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Memberships'],
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
        tags=['Memberships'],
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
        tags=['Memberships'],
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
