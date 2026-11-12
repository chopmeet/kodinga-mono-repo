from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.ai.models.audit import ModerationAuditLog
from apps.ai.serializers import ModerationAuditLogSerializer
from apps.communities.selectors.community_selector import CommunitySelector
from apps.memberships.models.member import CommunityMember, MembershipStatus
from common.permissions.base import is_superadmin_user
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response


class AIModerationAuditListView(APIView):
    """
    List content moderation audit logs for platform admins or community moderators.
    """

    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=["AI & Assistant"],
        summary="Journaux d'audit de modération IA",
        parameters=[
            OpenApiParameter(
                name="community",
                type=str,
                description="Slug de la communauté",
                required=False,
            ),
            OpenApiParameter(
                name="decision",
                type=str,
                description="Filtrer par décision (allow, reject, review)",
                required=False,
            ),
        ],
        responses={200: ModerationAuditLogSerializer(many=True)},
    )
    def get(self, request):
        qs = ModerationAuditLog.objects.select_related("user", "community").all()

        community_slug = request.query_params.get("community")
        if community_slug:
            try:
                community = CommunitySelector.get_community_by_slug(
                    community_slug, user=request.user
                )
            except Exception:
                return error_response(
                    "Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND
                )

            # Check permissions: user must be admin, or community owner/moderator
            is_staff = is_superadmin_user(request.user) or request.user.is_staff
            is_owner = community.owner_id == request.user.id
            membership = CommunityMember.objects.filter(
                community=community, user=request.user, status=MembershipStatus.ACTIVE
            ).first()
            is_mod = membership and membership.is_moderator

            if not (is_staff or is_owner or is_mod):
                return error_response(
                    "Seuls les modérateurs ou administrateurs peuvent consulter les journaux de modération.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

            qs = qs.filter(community=community)
        else:
            # Global listing: only platform staff
            if not (is_superadmin_user(request.user) or request.user.is_staff):
                return error_response(
                    "Paramètre ?community=<slug> requis pour les modérateurs de communauté.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        decision = request.query_params.get("decision")
        if decision:
            qs = qs.filter(decision=decision)

        paginator = self.pagination_class()
        paginated_logs = paginator.paginate_queryset(qs, request)
        serializer = ModerationAuditLogSerializer(paginated_logs, many=True)
        return paginator.get_paginated_response(serializer.data)
