from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from common.utils.responses import success_response, error_response
from apps.communities.selectors.community_selector import CommunitySelector
from apps.memberships.models.invitation import CommunityInvitation
from apps.memberships.models.member import CommunityRole
from apps.memberships.selectors.membership_selector import MembershipSelector
from apps.memberships.serializers.invitation import (
    AcceptInvitationSerializer,
    CommunityInvitationSerializer,
    CreateInvitationRequestSerializer,
)
from apps.memberships.serializers.member import CommunityMemberSerializer
from apps.memberships.services.membership_service import MembershipService


class CommunityInvitationsView(APIView):
    """
    Generate and list invitation links / email invites for a community.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Memberships'],
        summary="Lister les invitations actives de la communauté",
        responses={200: CommunityInvitationSerializer(many=True)}
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        from common.permissions.base import is_superadmin_user
        member = MembershipSelector.get_member(community, request.user)
        if not is_superadmin_user(request.user) and (not member or not member.is_admin):
            return error_response("Droits administrateur requis.", status_code=status.HTTP_403_FORBIDDEN)

        invitations = CommunityInvitation.objects.filter(
            community=community,
            is_revoked=False
        ).order_by('-created_at')

        return success_response(data=CommunityInvitationSerializer(invitations, many=True).data)

    @extend_schema(
        tags=['Memberships'],
        summary="Générer un lien ou une invitation par email",
        request=CreateInvitationRequestSerializer,
        responses={201: CommunityInvitationSerializer}
    )
    def post(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = CreateInvitationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        invitation = MembershipService.create_invitation(
            actor_user=request.user,
            community=community,
            email=data.get('email', ''),
            role=data.get('role', CommunityRole.MEMBER),
            max_uses=data.get('max_uses', 1),
            expires_in_days=data.get('expires_in_days', 7)
        )

        return success_response(
            data=CommunityInvitationSerializer(invitation).data,
            message="Invitation générée avec succès.",
            status_code=status.HTTP_201_CREATED
        )


class AcceptInvitationView(APIView):
    """
    Accept an invitation by its unique code.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Memberships'],
        summary="Accepter une invitation par code d'invitation",
        request=AcceptInvitationSerializer,
        responses={200: CommunityMemberSerializer}
    )
    def post(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite_code = serializer.validated_data['invite_code']

        invitation = MembershipSelector.get_invitation_by_code(invite_code)
        if not invitation or not invitation.is_valid:
            return error_response("L'invitation est invalide ou expirée.", status_code=status.HTTP_400_BAD_REQUEST)

        member = MembershipService.join_community(
            user=request.user,
            community=invitation.community,
            invite_code=invite_code
        )

        return success_response(
            data=CommunityMemberSerializer(member).data,
            message=f"Vous avez rejoint {invitation.community.name} avec succès !"
        )
