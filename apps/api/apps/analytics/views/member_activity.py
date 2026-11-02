from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions
from rest_framework.views import APIView

from apps.analytics.serializers.member_activity import (
    MemberActivityDashboardResponseSerializer,
    MemberCoursesResponseSerializer,
    MemberEventsResponseSerializer,
    MemberHackathonsResponseSerializer,
    MemberOpportunitiesResponseSerializer,
)
from apps.analytics.services.member_activity_service import MemberActivityService
from common.utils.responses import success_response

COMMUNITY_FILTER_PARAMETER = OpenApiParameter(
    name="community",
    type=OpenApiTypes.STR,
    location=OpenApiParameter.QUERY,
    required=False,
    description=(
        "Optionnel : filtrer les KPIs et les activités pour une communauté "
        "spécifique (slug ou UUID de la communauté)."
    ),
)


class _BaseMemberActivityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get_community_filter(self, request, **kwargs) -> str | None:
        return kwargs.get("slug") or request.query_params.get("community") or None


class MemberActivityDashboardView(_BaseMemberActivityView):
    """
    GET /api/v1/analytics/member/dashboard/
    GET /api/v1/users/me/dashboard/
    GET /api/v1/communities/<slug>/me/dashboard/
    Returns the authenticated member's unified KPIs and recent highlights across:
    - Hackathons (participations, wins, podiums, success/failure rates)
    - Events (registrations, attendance/check-in, upcoming vs completed)
    - Opportunities (applications, accepted, rejected, in-review)
    - Classroom Courses (enrollments, course levels, overall & module-by-module %)
    Supports optional `?community=<slug_or_uuid>` filter.
    """

    @extend_schema(
        tags=["Analytics - Member Activity"],
        summary="Obtenir le tableau de bord unifié des KPIs et activités du membre",
        parameters=[COMMUNITY_FILTER_PARAMETER],
        responses={200: MemberActivityDashboardResponseSerializer},
    )
    def get(self, request, *args, **kwargs):
        community = self._get_community_filter(request, **kwargs)
        data = MemberActivityService.get_member_dashboard(
            request.user, community=community
        )
        serializer = MemberActivityDashboardResponseSerializer(data)
        return success_response(data=serializer.data)


class MemberHackathonsView(_BaseMemberActivityView):
    """
    GET /api/v1/analytics/member/hackathons/
    GET /api/v1/users/me/hackathons/
    GET /api/v1/communities/<slug>/me/hackathons/
    Returns the authenticated member's hackathons, participation details,
    submissions, rankings, prizes won, and success/failure KPIs.
    Supports optional `?community=<slug_or_uuid>` filter.
    """

    @extend_schema(
        tags=["Analytics - Member Activity"],
        summary="Obtenir les KPIs et la liste détaillée des hackathons du membre",
        parameters=[COMMUNITY_FILTER_PARAMETER],
        responses={200: MemberHackathonsResponseSerializer},
    )
    def get(self, request, *args, **kwargs):
        community = self._get_community_filter(request, **kwargs)
        data = MemberActivityService.get_member_hackathons(
            request.user, community=community
        )
        serializer = MemberHackathonsResponseSerializer(data)
        return success_response(data=serializer.data)


class MemberEventsView(_BaseMemberActivityView):
    """
    GET /api/v1/analytics/member/events/
    GET /api/v1/users/me/events/
    GET /api/v1/communities/<slug>/me/events/
    Returns the authenticated member's events (registered, attended, upcoming,
    completed, missed) along with attendance KPIs.
    Supports optional `?community=<slug_or_uuid>` filter.
    """

    @extend_schema(
        tags=["Analytics - Member Activity"],
        summary="Obtenir les KPIs et la liste des événements du membre",
        parameters=[COMMUNITY_FILTER_PARAMETER],
        responses={200: MemberEventsResponseSerializer},
    )
    def get(self, request, *args, **kwargs):
        community = self._get_community_filter(request, **kwargs)
        data = MemberActivityService.get_member_events(
            request.user, community=community
        )
        serializer = MemberEventsResponseSerializer(data)
        return success_response(data=serializer.data)


class MemberOpportunitiesView(_BaseMemberActivityView):
    """
    GET /api/v1/analytics/member/opportunities/
    GET /api/v1/users/me/opportunities/
    GET /api/v1/communities/<slug>/me/opportunities/
    Returns the authenticated member's opportunity applications along with
    success (accepted), failure (rejected), and in-review KPIs.
    Supports optional `?community=<slug_or_uuid>` filter.
    """

    @extend_schema(
        tags=["Analytics - Member Activity"],
        summary="Obtenir les KPIs et l'historique des candidatures aux opportunités du membre",
        parameters=[COMMUNITY_FILTER_PARAMETER],
        responses={200: MemberOpportunitiesResponseSerializer},
    )
    def get(self, request, *args, **kwargs):
        community = self._get_community_filter(request, **kwargs)
        data = MemberActivityService.get_member_opportunities(
            request.user, community=community
        )
        serializer = MemberOpportunitiesResponseSerializer(data)
        return success_response(data=serializer.data)


class MemberCoursesView(_BaseMemberActivityView):
    """
    GET /api/v1/analytics/member/courses/
    GET /api/v1/users/me/courses/
    GET /api/v1/communities/<slug>/me/courses/
    Returns the authenticated member's enrolled courses, including course level,
    overall completion percentage, and module-by-module completion percentage.
    Supports optional `?community=<slug_or_uuid>` filter.
    """

    @extend_schema(
        tags=["Analytics - Member Activity"],
        summary="Obtenir les KPIs et la progression par module des formations du membre",
        parameters=[COMMUNITY_FILTER_PARAMETER],
        responses={200: MemberCoursesResponseSerializer},
    )
    def get(self, request, *args, **kwargs):
        community = self._get_community_filter(request, **kwargs)
        data = MemberActivityService.get_member_courses(
            request.user, community=community
        )
        serializer = MemberCoursesResponseSerializer(data)
        return success_response(data=serializer.data)
