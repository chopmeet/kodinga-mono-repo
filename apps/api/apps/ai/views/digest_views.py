from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai.serializers import CommunityWeeklyDigestSerializer
from apps.ai.services.digest_service import CommunityDigestService
from apps.ai.tasks import generate_community_weekly_digest_task
from apps.communities.models.community import Community
from apps.memberships.permissions import IsCommunityAdmin


class CommunityDigestCurrentView(APIView):
    """
    Retrieves the latest Community Pulse weekly digest for members and visitors.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, slug: str):
        community = get_object_or_404(Community, slug=slug)
        digest = CommunityDigestService.get_or_create_current_digest(community=community)
        serializer = CommunityWeeklyDigestSerializer(digest)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CommunityDigestTriggerView(APIView):
    """
    Manually triggers immediate or background generation of the weekly community pulse digest.
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

