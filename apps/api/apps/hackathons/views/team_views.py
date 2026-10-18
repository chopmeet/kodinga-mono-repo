from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.hackathons.models.team import HackathonTeam
from apps.hackathons.selectors.hackathon_selector import HackathonSelector
from apps.hackathons.serializers.team import (
    CreateTeamRequestSerializer,
    HackathonTeamMemberSerializer,
    HackathonTeamSerializer,
    InviteMemberRequestSerializer,
    RespondInvitationRequestSerializer,
)
from apps.hackathons.services.team_service import HackathonTeamService
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response


class HackathonTeamListCreateView(APIView):
    """
    GET / POST /api/v1/communities/<slug>/hackathons/<hackathon_slug>/teams/
    Lists all teams in a hackathon or creates a new team.
    """

    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Hackathons"],
        summary="Lister les équipes du hackathon",
        responses={200: HackathonTeamSerializer(many=True)},
    )
    def get(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        qs = (
            HackathonTeam.objects.filter(hackathon=hackathon)
            .select_related("leader")
            .prefetch_related("members__user")
            .order_by("name")
        )
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        serializer = HackathonTeamSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        tags=["Hackathons"],
        summary="Créer une nouvelle équipe",
        request=CreateTeamRequestSerializer,
        responses={201: HackathonTeamSerializer},
    )
    def post(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )

        serializer = CreateTeamRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        team = HackathonTeamService.create_team(
            leader=request.user,
            hackathon=hackathon,
            name=serializer.validated_data["name"],
            tagline=serializer.validated_data.get("tagline", ""),
            avatar_url=serializer.validated_data.get("avatar_url", ""),
        )

        return success_response(
            data=HackathonTeamSerializer(team).data,
            message=f"Équipe '{team.name}' créée avec succès.",
            status_code=status.HTTP_201_CREATED,
        )


class HackathonTeamDetailView(APIView):
    """
    GET / DELETE /api/v1/communities/<slug>/hackathons/<hackathon_slug>/teams/<uuid:team_id>/
    Retrieves team details or leaves/deletes the team.
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Hackathons"],
        summary="Détails d'une équipe",
        responses={200: HackathonTeamSerializer},
    )
    def get(self, request, slug, hackathon_slug, team_id):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        team = (
            HackathonTeam.objects.filter(id=team_id, hackathon=hackathon)
            .select_related("leader")
            .prefetch_related("members__user")
            .first()
        )
        if not team:
            return error_response("Équipe introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        return success_response(data=HackathonTeamSerializer(team).data)

    @extend_schema(
        tags=["Hackathons"],
        summary="Quitter ou dissoudre l'équipe",
        responses={200: None},
    )
    def delete(self, request, slug, hackathon_slug, team_id):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        team = HackathonTeam.objects.filter(id=team_id, hackathon=hackathon).first()
        if not team:
            return error_response("Équipe introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        HackathonTeamService.leave_team(request.user, team)
        return success_response(message="Action effectuée avec succès.")


class HackathonTeamInviteView(APIView):
    """
    POST /api/v1/communities/<slug>/hackathons/<hackathon_slug>/teams/<uuid:team_id>/invite/
    Invites a participant into the team.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Hackathons"],
        summary="Inviter un membre dans l'équipe",
        request=InviteMemberRequestSerializer,
        responses={201: HackathonTeamMemberSerializer},
    )
    def post(self, request, slug, hackathon_slug, team_id):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        team = HackathonTeam.objects.filter(id=team_id, hackathon=hackathon).first()
        if not team:
            return error_response("Équipe introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = InviteMemberRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        membership = HackathonTeamService.invite_member(
            leader=request.user,
            team=team,
            invitee_identifier=serializer.validated_data["identifier"],
        )

        return success_response(
            data=HackathonTeamMemberSerializer(membership).data,
            message="Invitation envoyée avec succès.",
            status_code=status.HTTP_201_CREATED,
        )


class HackathonTeamRespondInviteView(APIView):
    """
    POST /api/v1/communities/<slug>/hackathons/<hackathon_slug>/teams/respond-invite/
    Accepts or declines a team invitation.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Hackathons"],
        summary="Répondre à une invitation d'équipe",
        request=RespondInvitationRequestSerializer,
        responses={200: HackathonTeamMemberSerializer},
    )
    def post(self, request, slug, hackathon_slug):
        HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )

        serializer = RespondInvitationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        membership = HackathonTeamService.respond_invitation(
            user=request.user,
            team_id=str(serializer.validated_data["team_id"]),
            accept=serializer.validated_data["accept"],
        )

        action_label = "acceptée" if serializer.validated_data["accept"] else "déclinée"
        return success_response(
            data=HackathonTeamMemberSerializer(membership).data,
            message=f"Invitation {action_label} avec succès.",
        )
