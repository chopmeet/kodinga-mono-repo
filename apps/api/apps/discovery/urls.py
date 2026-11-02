from apps.discovery.views.discovery import (
    DiscoveryRecommendationsView,
    DiscoverySearchView,
    DiscoveryTrendingView,
)
from django.urls import path

app_name = "discovery"

urlpatterns = [
    path(
        "discovery/search/",
        DiscoverySearchView.as_view(),
        name="discovery-search",
    ),
    path(
        "discovery/trending/",
        DiscoveryTrendingView.as_view(),
        name="discovery-trending",
    ),
    path(
        "discovery/recommendations/",
        DiscoveryRecommendationsView.as_view(),
        name="discovery-recommendations",
    ),
]
