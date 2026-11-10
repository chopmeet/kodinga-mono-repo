from django.urls import path

from apps.analytics.views.analytics import (
    AnalyticsEngagementView,
    AnalyticsFinancialView,
    AnalyticsMetricsListView,
    AnalyticsMonthlyGrowthView,
    AnalyticsOverviewView,
)
from apps.analytics.views.member_activity import (
    MemberActivityDashboardView,
    MemberCoursesView,
    MemberEventsView,
    MemberHackathonsView,
    MemberOpportunitiesView,
)

app_name = "analytics"

urlpatterns = [
    # Administration Platform Analytics (Superadmin)
    path(
        "analytics/overview/",
        AnalyticsOverviewView.as_view(),
        name="analytics_overview",
    ),
    path(
        "analytics/financial/",
        AnalyticsFinancialView.as_view(),
        name="analytics_financial",
    ),
    path(
        "analytics/engagement/",
        AnalyticsEngagementView.as_view(),
        name="analytics_engagement",
    ),
    path(
        "analytics/growth/",
        AnalyticsMonthlyGrowthView.as_view(),
        name="analytics_growth",
    ),
    path(
        "analytics/monthly-growth/",
        AnalyticsMonthlyGrowthView.as_view(),
        name="analytics_monthly_growth",
    ),
    path(
        "analytics/metrics/",
        AnalyticsMetricsListView.as_view(),
        name="analytics_metrics_list",
    ),
    # Member Activity & Portfolio Analytics (Authenticated Member - Global or ?community=<slug_or_uuid>)
    path(
        "analytics/member/dashboard/",
        MemberActivityDashboardView.as_view(),
        name="member_dashboard",
    ),
    path(
        "analytics/member/hackathons/",
        MemberHackathonsView.as_view(),
        name="member_hackathons",
    ),
    path("analytics/member/events/", MemberEventsView.as_view(), name="member_events"),
    path(
        "analytics/member/opportunities/",
        MemberOpportunitiesView.as_view(),
        name="member_opportunities",
    ),
    path(
        "analytics/member/courses/", MemberCoursesView.as_view(), name="member_courses"
    ),
    # Community-Scoped Member KPIs & Activity (Authenticated Member inside a specific Community)
    path(
        "communities/<str:slug>/me/dashboard/",
        MemberActivityDashboardView.as_view(),
        name="community_member_dashboard",
    ),
    path(
        "communities/<str:slug>/me/hackathons/",
        MemberHackathonsView.as_view(),
        name="community_member_hackathons",
    ),
    path(
        "communities/<str:slug>/me/events/",
        MemberEventsView.as_view(),
        name="community_member_events",
    ),
    path(
        "communities/<str:slug>/me/opportunities/",
        MemberOpportunitiesView.as_view(),
        name="community_member_opportunities",
    ),
    path(
        "communities/<str:slug>/me/courses/",
        MemberCoursesView.as_view(),
        name="community_member_courses",
    ),
]
