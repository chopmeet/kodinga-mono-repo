from django.urls import path

from apps.gamification.views.badge import BadgeListView, UserBadgeListView
from apps.gamification.views.leaderboard import (
    CommunityLeaderboardView,
    GlobalLeaderboardView,
)
from apps.gamification.views.reputation import (
    ReputationHistoryView,
    UserReputationDetailView,
)

app_name = "gamification"

urlpatterns = [
    # Reputation
    path(
        "gamification/reputation/me/",
        UserReputationDetailView.as_view(),
        name="reputation-me",
    ),
    path(
        "gamification/reputation/history/",
        ReputationHistoryView.as_view(),
        name="reputation-history",
    ),
    # Badges
    path(
        "gamification/badges/",
        BadgeListView.as_view(),
        name="badges-list",
    ),
    path(
        "gamification/badges/my/",
        UserBadgeListView.as_view(),
        name="user-badges",
    ),
    # Leaderboards
    path(
        "gamification/leaderboard/",
        GlobalLeaderboardView.as_view(),
        name="global-leaderboard",
    ),
    path(
        "communities/<slug:slug>/leaderboard/",
        CommunityLeaderboardView.as_view(),
        name="community-leaderboard",
    ),
]
