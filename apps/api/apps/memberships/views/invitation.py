from django.conf import settings
from django.db import models
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.communities.selectors.community_selector import CommunitySelector
from apps.memberships.models.invitation import (
    CommunityInvitation,
)
from apps.memberships.models.member import CommunityRole, MembershipStatus
from apps.memberships.permissions import has_community_permission
from apps.memberships.selectors.membership_selector import MembershipSelector
from apps.memberships.serializers.invitation import (
    AcceptInvitationSerializer,
    CommunityInvitationSerializer,
    CreateInvitationRequestSerializer,
    CreateWorkspaceInvitationSerializer,
    DeclineInvitationSerializer,
    PublicInvitationDetailSerializer,
    WorkspaceInvitationSerializer,
)
from apps.memberships.serializers.member import CommunityMemberSerializer
from apps.memberships.services.invitation_service import InvitationService
from apps.memberships.services.membership_service import MembershipService
from apps.memberships.throttling import (
    PublicInvitationRateThrottle,
    WorkspaceInvitationRateThrottle,
)
from common.permissions.base import is_superadmin_user
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response


class WorkspaceInvitationsView(APIView):
    """
    Manage collaborator invitations for a workspace.
    - POST: Create and dispatch a new collaborator invitation (Admin only, 20/hr rate limit).
    - GET: List all invitations for the workspace (Admin only, paginated).
    """
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_throttles(self):
        if self.request.method == 'POST':
            return [WorkspaceInvitationRateThrottle()]
        return []

    def _resolve_workspace(self, request, workspace_id):
        try:
            return CommunitySelector.get_community_by_slug(workspace_id, user=request.user)
        except Exception:
            return None

    def _check_admin(self, request, workspace):
        if is_superadmin_user(request.user) or workspace.owner_id == request.user.id:
            return True
        member = MembershipSelector.get_member(workspace, request.user)
        return bool(member and member.status == MembershipStatus.ACTIVE and member.is_admin)

    def _can_invite(self, request, workspace):
        if self._check_admin(request, workspace):
            return True
        member = MembershipSelector.get_member(workspace, request.user)
        if not member or member.status != MembershipStatus.ACTIVE:
            return False
        return bool(
            getattr(getattr(workspace, 'settings', None), 'allow_member_invites', False)
            or has_community_permission(request.user, workspace, 'can_invite_members')
        )

    @extend_schema(
        tags=['Communities & Workspaces', 'Workspaces & Invitations'],
        summary="Lister les invitations de l'espace (Admin)",
        description="Renvoie la liste paginée des invitations de l'espace avec leur statut (pending, accepted, declined, revoked, expired).",
        parameters=[
            OpenApiParameter(name='status', description="Filtrer par statut (pending, accepted, declined, revoked, expired, all)", required=False, type=str),
            OpenApiParameter(name='page', description="Numéro de page", required=False, type=int),
        ],
        responses={200: WorkspaceInvitationSerializer(many=True)}
    )
    def get(self, request, workspace_id):
        workspace = self._resolve_workspace(request, workspace_id)
        if not workspace:
            return error_response("Espace introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        if not self._check_admin(request, workspace):
            return error_response("Droits administrateur requis pour consulter les invitations.", status_code=status.HTTP_403_FORBIDDEN)

        status_filter = request.query_params.get('status')
        queryset = CommunityInvitation.objects.filter(community=workspace).select_related(
            'community', 'invited_by', 'invited_by__profile'
        ).order_by('-created_at')

        if status_filter and status_filter.lower() != 'all':
            queryset = queryset.filter(status=status_filter.lower())

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = WorkspaceInvitationSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        tags=['Communities & Workspaces', 'Workspaces & Invitations'],
        summary="Inviter un collaborateur par e-mail (Admin)",
        description="Crée une invitation cryptographiquement sécurisée, envoie l'e-mail avec le lien d'acceptation et enregistre l'événement dans le journal d'audit.",
        request=CreateWorkspaceInvitationSerializer,
        responses={201: WorkspaceInvitationSerializer}
    )
    def post(self, request, workspace_id):
        workspace = self._resolve_workspace(request, workspace_id)
        if not workspace:
            return error_response("Espace introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        if not self._check_admin(request, workspace):
            return error_response("Droits administrateur requis pour inviter des collaborateurs.", status_code=status.HTTP_403_FORBIDDEN)

        serializer = CreateWorkspaceInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        invitation, raw_token = InvitationService.create_invitation(
            actor_user=request.user,
            workspace=workspace,
            email=data['email'],
            role=data.get('role', 'viewer'),
            expires_in_days=data.get('expires_in_days', 7),
            request=request
        )

        resp_data = WorkspaceInvitationSerializer(invitation).data
        resp_data['raw_token'] = raw_token

        return success_response(
            data=resp_data,
            message=f"Invitation envoyée avec succès à {invitation.email}.",
            status_code=status.HTTP_201_CREATED
        )


class WorkspaceInvitationResendView(APIView):
    """
    Resend an invitation with a new cryptographic token and renewed 7-day expiration.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Workspaces & Invitations', 'Communities & Workspaces'],
        summary="Renvoyer une invitation (Admin)",
        description="Régénère un nouveau token sécurisé, repousse l'expiration à +7 jours et réexpédie l'e-mail d'invitation.",
        request=None,
        responses={200: WorkspaceInvitationSerializer}
    )
    def post(self, request, workspace_id, invitation_id):
        try:
            workspace = CommunitySelector.get_community_by_slug(workspace_id, user=request.user)
        except Exception:
            return error_response("Espace introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        invitation, raw_token = InvitationService.resend_invitation(
            actor_user=request.user,
            workspace=workspace,
            invitation_id=invitation_id,
            request=request
        )

        resp_data = WorkspaceInvitationSerializer(invitation).data
        resp_data['raw_token'] = raw_token

        return success_response(
            data=resp_data,
            message="Invitation renvoyée avec succès."
        )


class WorkspaceInvitationDetailView(APIView):
    """
    Revoke a workspace invitation.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Workspaces', 'Workspaces & Invitations'],
        summary="Révoquer une invitation (Admin)",
        description="Révoque une invitation en attente. Le lien devient immédiatement inutilisable.",
        request=None,
        responses={200: WorkspaceInvitationSerializer}
    )
    def delete(self, request, workspace_id, invitation_id):
        try:
            workspace = CommunitySelector.get_community_by_slug(workspace_id, user=request.user)
        except Exception:
            return error_response("Espace introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        invitation = InvitationService.revoke_invitation(
            actor_user=request.user,
            workspace=workspace,
            invitation_id=invitation_id,
            request=request
        )

        return success_response(
            data=WorkspaceInvitationSerializer(invitation).data,
            message="Invitation révoquée avec succès."
        )


class PublicInvitationDetailView(APIView):
    """
    Public metadata inspection for an invitation token.
    Allows frontend to display space name, masked email and role before logging in.
    """
    permission_classes = [AllowAny]
    throttle_classes = [PublicInvitationRateThrottle]

    @extend_schema(
        tags=['Communities & Workspaces', 'Workspaces & Invitations'],
        summary="Consulter les détails publics d'une invitation (Public)",
        description="Renvoie les métadonnées publiques nécessaires à la page d'acceptation (nom de l'espace, rôle proposé, email masqué, statut) sans nécessiter de connexion.",
        responses={200: PublicInvitationDetailSerializer}
    )
    def get(self, request, token):
        data = InvitationService.get_public_invitation_info(token)
        return success_response(data=data)


class AcceptInvitationTokenView(APIView):
    """
    Accept an invitation using its secure cryptographic token.
    Requires authentication with the corresponding invited email address.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Workspaces', 'Workspaces & Invitations'],
        summary="Accepter une invitation (Utilisateur authentifié)",
        description="Accepte l'invitation de manière atomique et ajoute l'utilisateur comme membre de l'espace avec le rôle défini. Valide que l'email connecté correspond à l'email invité.",
        request=None,
        responses={200: CommunityMemberSerializer}
    )
    def post(self, request, token):
        member = InvitationService.accept_invitation(
            user=request.user,
            raw_token=token,
            request=request
        )
        return success_response(
            data=CommunityMemberSerializer(member).data,
            message=f"Félicitations ! Vous avez rejoint l'espace {member.community.name} avec succès."
        )


class DeclineInvitationTokenView(APIView):
    """
    Decline an invitation using its secure cryptographic token or UUID.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Workspaces', 'Workspaces & Invitations'],
        summary="Refuser une invitation (Utilisateur authentifié)",
        description="Refuse l'invitation en attente, met à jour son statut à 'declined' et notifie l'expéditeur.",
        request=None,
        responses={200: WorkspaceInvitationSerializer}
    )
    def post(self, request, token):
        invitation = InvitationService.decline_invitation(
            user=request.user,
            raw_token=token,
            request=request
        )
        return success_response(
            data=WorkspaceInvitationSerializer(invitation).data,
            message=f"Vous avez décliné l'invitation pour l'espace {invitation.community.name}."
        )


class DeclineInvitationView(APIView):
    """
    Decline an invitation via payload (token, invite_code, or invitation_id).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Refuser une invitation",
        request=DeclineInvitationSerializer,
        responses={200: WorkspaceInvitationSerializer}
    )
    def post(self, request):
        serializer = DeclineInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token_or_code = (
            serializer.validated_data.get('token')
            or serializer.validated_data.get('invite_code')
            or (str(serializer.validated_data['invitation_id']) if serializer.validated_data.get('invitation_id') else None)
        )
        if not token_or_code:
            return error_response("Le token ou l'identifiant d'invitation est requis.", status_code=status.HTTP_400_BAD_REQUEST)

        invitation = InvitationService.decline_invitation(
            user=request.user,
            raw_token=token_or_code,
            request=request
        )
        return success_response(
            data=WorkspaceInvitationSerializer(invitation).data,
            message=f"Vous avez décliné l'invitation pour {invitation.community.name}."
        )


class MyReceivedInvitationsView(APIView):
    """
    List invitations received by the currently authenticated user (matched by email).
    """
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=['Communities & Memberships', 'Workspaces & Invitations'],
        summary="Lister mes invitations reçues",
        parameters=[
            OpenApiParameter(name='status', description="Filtrer par statut (pending, accepted, declined, all)", required=False, type=str),
        ],
        responses={200: WorkspaceInvitationSerializer(many=True)}
    )
    def get(self, request):
        status_filter = request.query_params.get('status', 'pending')
        queryset = CommunityInvitation.objects.filter(
            email__iexact=request.user.email.strip()
        ).select_related('community', 'invited_by', 'invited_by__profile').order_by('-created_at')

        if status_filter and status_filter.lower() != 'all':
            queryset = queryset.filter(status=status_filter.lower())

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = WorkspaceInvitationSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


# ==============================================================================
# Legacy backward-compatible Views (for existing routes)
# ==============================================================================

class CommunityInvitationsView(WorkspaceInvitationsView):
    """
    Legacy view for /api/v1/communities/<slug>/invitations/
    """
    def get(self, request, slug):
        return super().get(request, workspace_id=slug)

    def post(self, request, slug):
        workspace = self._resolve_workspace(request, slug)
        if not workspace:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        if not self._can_invite(request, workspace):
            return error_response("Droits administrateur requis.", status_code=status.HTTP_403_FORBIDDEN)

        # Check if targeted user/email invite or group link invite
        has_target_user = bool(
            request.data.get('email')
            or request.data.get('user_id')
            or request.data.get('username')
        )
        if has_target_user:
            serializer = CreateWorkspaceInvitationSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data
            invitation, raw_token = InvitationService.create_invitation(
                actor_user=request.user,
                workspace=workspace,
                email=data['email'],
                role=data.get('role', 'viewer'),
                expires_in_days=data.get('expires_in_days', 7),
                request=request,
                allow_member_invite=True,
            )
            resp = CommunityInvitationSerializer(invitation).data
            resp['invite_code'] = raw_token
            resp['raw_token'] = raw_token
            return success_response(
                data=resp,
                message="Invitation générée avec succès.",
                status_code=status.HTTP_201_CREATED
            )

        # Fallback to group link creation
        serializer = CreateInvitationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        invitation = MembershipService.create_invitation(
            actor_user=request.user,
            community=workspace,
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
    Legacy view for /api/v1/invitations/accept/
    Supports both legacy invite_code, token, and invitation_id payload.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Accepter une invitation (Legacy)",
        request=AcceptInvitationSerializer,
        responses={200: CommunityMemberSerializer}
    )
    def post(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token_or_code = (
            serializer.validated_data.get('token')
            or serializer.validated_data.get('invite_code')
            or (str(serializer.validated_data['invitation_id']) if serializer.validated_data.get('invitation_id') else None)
        )

        if not token_or_code:
            return error_response("Le token d'invitation est requis.", status_code=status.HTTP_400_BAD_REQUEST)

        # Attempt modern accept
        token_hash = from_tokens_hash(token_or_code)
        q = models.Q(token_hash=token_hash) | models.Q(invite_code=token_or_code)
        try:
            import uuid
            uuid.UUID(str(token_or_code))
            q = q | models.Q(id=token_or_code)
        except Exception:
            pass
        invitation = CommunityInvitation.objects.filter(q).first()

        if invitation and invitation.email:
            member = InvitationService.accept_invitation(
                user=request.user,
                raw_token=token_or_code,
                request=request
            )
            return success_response(
                data=CommunityMemberSerializer(member).data,
                message=f"Vous avez rejoint {member.community.name} avec succès !"
            )

        # Legacy group link acceptance fallback
        invitation = MembershipSelector.get_invitation_by_code(token_or_code)
        if not invitation or not invitation.is_valid:
            return error_response("L'invitation est invalide ou expirée.", status_code=status.HTTP_400_BAD_REQUEST)

        member = MembershipService.join_community(
            user=request.user,
            community=invitation.community,
            invite_code=token_or_code
        )
        return success_response(
            data=CommunityMemberSerializer(member).data,
            message=f"Vous avez rejoint {invitation.community.name} avec succès !"
        )


def from_tokens_hash(raw_token: str) -> str:
    from common.utils.tokens import hash_token
    return hash_token(raw_token.strip())


class CommunityShareableInviteLinkView(APIView):
    """
    Générer ou récupérer le lien d'invitation partageable d'une communauté.
    GET / POST /api/v1/communities/<slug>/invitations/share-link/
    """
    permission_classes = [IsAuthenticated]

    def _resolve_community(self, request, slug):
        try:
            return CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return None

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Obtenir ou générer un lien d'invitation partageable",
        responses={200: dict}
    )
    def get(self, request, slug):
        community = self._resolve_community(request, slug)
        if not community:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        role = request.query_params.get('role', 'member')
        invitation, raw_token = InvitationService.get_or_create_shareable_link(
            actor_user=request.user,
            workspace=community,
            role=role,
            request=request,
        )

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        share_url = f"{frontend_url}/invite/{raw_token}"
        return success_response(
            data={
                "community_id": str(community.id),
                "community_slug": community.slug,
                "share_url": share_url,
                "token": raw_token,
                "role": invitation.role,
                "expires_at": invitation.expires_at,
                "uses_count": invitation.uses_count,
            }
        )

    def post(self, request, slug):
        community = self._resolve_community(request, slug)
        if not community:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        role = request.data.get('role', 'member') if isinstance(request.data, dict) else 'member'
        invitation, raw_token = InvitationService.get_or_create_shareable_link(
            actor_user=request.user,
            workspace=community,
            role=role,
            request=request,
        )

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        share_url = f"{frontend_url}/invite/{raw_token}"
        return success_response(
            data={
                "community_id": str(community.id),
                "community_slug": community.slug,
                "share_url": share_url,
                "token": raw_token,
                "role": invitation.role,
                "expires_at": invitation.expires_at,
                "uses_count": invitation.uses_count,
            },
            message="Lien d'invitation généré avec succès."
        )
