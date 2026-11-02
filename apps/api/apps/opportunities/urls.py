from apps.opportunities.views import (
    ApplicationStatusUpdateView,
    MyApplicationListView,
    MyOpportunityListView,
    OpportunityApplicationsListView,
    OpportunityApplyView,
    OpportunityDetailView,
    OpportunityListView,
)
from django.urls import path

app_name = "opportunities"

urlpatterns = [
    path("opportunities/", OpportunityListView.as_view(), name="opportunity_list"),
    path("opportunities/my/", MyOpportunityListView.as_view(), name="my_opportunities"),
    path("opportunities/my-applications/", MyApplicationListView.as_view(), name="my_applications"),
    path(
        "opportunities/applications/<uuid:application_id>/status/",
        ApplicationStatusUpdateView.as_view(),
        name="application_status_update",
    ),
    path(
        "opportunities/<slug:slug>/",
        OpportunityDetailView.as_view(),
        name="opportunity_detail",
    ),
    path(
        "opportunities/<slug:slug>/apply/",
        OpportunityApplyView.as_view(),
        name="opportunity_apply",
    ),
    path(
        "opportunities/<slug:slug>/applications/",
        OpportunityApplicationsListView.as_view(),
        name="opportunity_applications",
    ),
]
