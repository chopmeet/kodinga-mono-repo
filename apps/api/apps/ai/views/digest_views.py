from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai.models.digest import CommunityWeeklyDigest
from apps.ai.serializers import CommunityWeeklyDigestSerializer
from apps.ai.services.digest_service import CommunityDigestService
from apps.ai.tasks import generate_community_weekly_digest_task
from apps.communities.models.community import Community, CommunityPrivacy
from apps.memberships.models.member import CommunityMember, MembershipStatus
from apps.memberships.permissions import IsCommunityAdmin
from common.permissions.base import is_superadmin_user


class CommunityDigestCurrentView(APIView):
    """
    Retrieves the latest Community Pulse weekly digest.
    Restricts access to active members for private or secret communities,
    and prevents non-members from triggering AI generation.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str):
        community = get_object_or_404(Community, slug=slug)

        is_owner = community.owner_id == request.user.id
        is_super = is_superadmin_user(request.user)
        is_member = is_owner or is_super or CommunityMember.objects.filter(
            community=community,
            user=request.user,
            status=MembershipStatus.ACTIVE,
        ).exists()

        # Strict privacy check: private and secret communities are reserved for members only
        if community.privacy_type in [CommunityPrivacy.PRIVATE, CommunityPrivacy.SECRET] and not is_member:
            raise PermissionDenied(
                "Cette communauté est privée. Vous devez être membre pour consulter son résumé hebdomadaire."
            )

        # Do not allow non-members to trigger costly on-the-fly AI generation
        if not is_member:
            digest = CommunityWeeklyDigest.objects.filter(community=community).order_by("-created_at").first()
            if not digest:
                raise NotFound("Aucun résumé n'a encore été généré pour cette communauté.")
        else:
            digest = CommunityDigestService.get_or_create_current_digest(community=community)

        serializer = CommunityWeeklyDigestSerializer(digest)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CommunityDigestTriggerView(APIView):
    """
    Manually triggers immediate or background generation of the weekly community pulse digest.
    Restricted to Community Admins and Owners.
    """

    permission_classes = [permissions.IsAuthenticated, IsCommunityAdmin]

    def post(self, request, slug: str):
        community = get_object_or_404(Community, slug=slug)
        self.check_object_permissions(request, community)

        run_async = request.data.get("async", True)
        week_id = request.data.get("week_identifier")

        if run_async:
            generate_community_weekly_digest_task.delay(
                community_id=str(community.id),
                week_identifier=week_id,
                force_refresh=True,
            )
            return Response(
                {
                    "message": "Génération asynchrone du digest hebdomadaire initiée.",
                    "community": community.slug,
                },
                status=status.HTTP_202_ACCEPTED,
            )

        digest = CommunityDigestService.generate_weekly_digest(
            community=community,
            week_identifier=week_id,
            force_refresh=True,
        )
        serializer = CommunityWeeklyDigestSerializer(digest)
        return Response(serializer.data, status=status.HTTP_200_OK)
