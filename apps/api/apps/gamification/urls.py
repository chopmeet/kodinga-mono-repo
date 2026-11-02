from apps.gamification.views.badge import BadgeListView, UserBadgeListView
from apps.gamification.views.community_config import (
    CommunityManualPointsAdjustView,
    CommunityPointRuleAuditHistoryView,
    CommunityPointRuleDetailView,
    CommunityPointRuleListUpdateView,
    CommunityTransactionsAdminListView,
)
from apps.gamification.views.leaderboard import (
    CommunityLeaderboardView,
    CommunityMyLeaderboardPositionView,
    GlobalLeaderboardView,
)
from apps.gamification.views.reputation import (
    CommunityGamificationStatsView,
    CommunityMemberPointsDetailView,
    CommunityMemberPointsHistoryView,
    CommunityMemberPointsMeView,
    ReputationHistoryView,
    UserReputationDetailView,
)
from django.urls import path

app_name = "gamification"

urlpatterns = [
    # 1. Global Reputation & History
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
    # 2. Badges
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
    # 3. Global Leaderboard
    path(
        "gamification/leaderboard/",
        GlobalLeaderboardView.as_view(),
        name="global-leaderboard",
    ),
    # 4. Community Leaderboard & Current Member Position
    path(
        "communities/<slug:slug>/leaderboard/",
        CommunityLeaderboardView.as_view(),
        name="community-leaderboard",
    ),
    path(
        "communities/<slug:slug>/leaderboard/me/",
        CommunityMyLeaderboardPositionView.as_view(),
        name="community-leaderboard-me",
    ),
    path(
        "communities/<slug:slug>/gamification/leaderboard/",
        CommunityLeaderboardView.as_view(),
        name="community-gamification-leaderboard",
    ),
    path(
        "communities/<slug:slug>/gamification/leaderboard/me/",
        CommunityMyLeaderboardPositionView.as_view(),
        name="community-gamification-leaderboard-me",
    ),
    # 5. Community Member Points Consultation & Global Community Stats
    path(
        "communities/<slug:slug>/gamification/points/me/",
        CommunityMemberPointsMeView.as_view(),
        name="community-member-points-me",
    ),
    path(
        "communities/<slug:slug>/gamification/members/<uuid:user_id>/points/",
        CommunityMemberPointsDetailView.as_view(),
        name="community-member-points-detail",
    ),
    path(
        "communities/<slug:slug>/gamification/points/history/",
        CommunityMemberPointsHistoryView.as_view(),
        name="community-member-points-history",
    ),
    path(
        "communities/<slug:slug>/gamification/stats/",
        CommunityGamificationStatsView.as_view(),
        name="community-gamification-stats",
    ),
    # 6. Community Point Scale (Barème) Configuration & Audit History
    path(
        "communities/<slug:slug>/gamification/rules/",
        CommunityPointRuleListUpdateView.as_view(),
        name="community-gamification-rules",
    ),
    path(
        "communities/<slug:slug>/gamification/rules/history/",
        CommunityPointRuleAuditHistoryView.as_view(),
        name="community-gamification-rules-history",
    ),
    path(
        "communities/<slug:slug>/gamification/rules/<str:action>/",
        CommunityPointRuleDetailView.as_view(),
        name="community-gamification-rule-detail",
    ),
    # 7. Community Points Administration (Manual Adjustments & Full Transactions Log)
    path(
        "communities/<slug:slug>/gamification/points/adjust/",
        CommunityManualPointsAdjustView.as_view(),
        name="community-gamification-points-adjust",
    ),
    path(
        "communities/<slug:slug>/gamification/transactions/",
        CommunityTransactionsAdminListView.as_view(),
        name="community-gamification-transactions-admin",
    ),
]
