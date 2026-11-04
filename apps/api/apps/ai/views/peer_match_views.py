from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai.models.peer_match import PeerMatchRecommendation
from apps.ai.serializers import (
    HackathonTeammateRequestSerializer,
    PeerMatchResponseSerializer,
)
from apps.ai.services.peer_match_service import PeerMatchService
from apps.communities.models.community import Community
from apps.hackathons.models.hackathon import Hackathon
from apps.memberships.models.member import CommunityMember, MembershipStatus


class CommunityPeerMatchView(APIView):
    """
    Retrieves or triggers AI peer matching recommendations for the authenticated member.
    """

    permission_classes = [permissions.IsAuthenticated]

    def _ensure_active_member(self, request, community: Community) -> CommunityMember:
        member = CommunityMember.objects.filter(
            community=community,
            user=request.user,
            status=MembershipStatus.ACTIVE,
        ).first()
        if not member:
            raise PermissionDenied("Vous devez être membre actif de cette communauté.")
        return member

    def get(self, request, slug: str):
        community = get_object_or_404(Community, slug=slug)
        self._ensure_active_member(request, community)

        matches = PeerMatchService.get_or_generate_peer_matches(
            user=request.user,
            community=community,
        )
        return Response(matches, status=status.HTTP_200_OK)

    def post(self, request, slug: str):
        community = get_object_or_404(Community, slug=slug)
        self._ensure_active_member(request, community)

        matches = PeerMatchService.get_or_generate_peer_matches(
            user=request.user,
            community=community,
        )
        return Response(matches, status=status.HTTP_200_OK)


class HackathonTeammateSuggestionView(APIView):
    """
    Recommends complementary hackathon teammates based on skill gaps and goals.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug: str):
        community = get_object_or_404(Community, slug=slug)
        member = CommunityMember.objects.filter(
            community=community,
            user=request.user,
            status=MembershipStatus.ACTIVE,
        ).first()
        if not member:
            raise PermissionDenied("Vous devez être membre actif de cette communauté.")

        serializer = HackathonTeammateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        hackathon_id = serializer.validated_data.get("hackathon_id")
        desired_skills = serializer.validated_data.get("desired_skills", [])
        limit = serializer.validated_data.get("limit", 3)

        if hackathon_id:
            hackathon = get_object_or_404(Hackathon, id=hackathon_id, community=community)
            suggestions = PeerMatchService.suggest_hackathon_teammates(
                user=request.user,
                hackathon=hackathon,
                desired_skills=desired_skills,
                limit=limit,
            )
        else:
            # Fallback to community peer matches
            suggestions = PeerMatchService.get_or_generate_peer_matches(
                user=request.user,
                community=community,
                limit=limit,
            )

        return Response(suggestions, status=status.HTTP_200_OK)


class PeerMatchRespondView(APIView):
    """
    Accepts or declines a peer match recommendation.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk: str):
        serializer = PeerMatchResponseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data["action"]
        rec = get_object_or_404(PeerMatchRecommendation, id=pk)

        updated = PeerMatchService.respond_to_match(
            user=request.user,
            match_id=str(rec.id),
            action=action,
        )

        return Response(
            {
                "id": str(updated.id),
                "status": updated.status,
            },
            status=status.HTTP_200_OK,
        )
