from django.urls import path

from apps.affiliates.views import (
    AffiliateClickTrackView,
    AffiliateLinkDetailView,
    AffiliateLinkListView,
    AffiliateStatsView,
    PayoutRequestListView,
)

app_name = "affiliates"

urlpatterns = [
    path("affiliates/links/", AffiliateLinkListView.as_view(), name="link_list"),
    path("affiliates/links/<str:code_or_id>/", AffiliateLinkDetailView.as_view(), name="link_detail"),
    path("affiliates/stats/", AffiliateStatsView.as_view(), name="stats"),
    path("affiliates/track-click/", AffiliateClickTrackView.as_view(), name="track_click"),
    path("affiliates/payouts/", PayoutRequestListView.as_view(), name="payouts"),
]
