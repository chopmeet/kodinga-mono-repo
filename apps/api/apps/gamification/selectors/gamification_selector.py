from datetime import timedelta
from typing import Optional

from django.db.models import QuerySet, Sum
from django.utils import timezone

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.gamification.models.badge import Badge, UserBadge
from apps.gamification.models.reputation import (
    ReputationTransaction,
    UserReputation,
)


class GamificationSelector:
    """
    Query selectors for gamification profiles, achievements and leaderboards.
    """

    @classmethod
    def get_user_reputation(cls, user: User) -> UserReputation:
        rep, _ = UserReputation.objects.get_or_create(
            user=user,
            defaults={"total_points": 0, "level": 1, "rank_title": "Initié"},
        )
        return rep

    @classmethod
    def get_user_badges(cls, user: User) -> QuerySet[UserBadge]:
        return (
            UserBadge.objects.filter(user=user)
            .select_related("badge", "community")
            .order_by("-awarded_at")
        )

    @classmethod
    def get_available_badges(
        cls, category: Optional[str] = None
    ) -> QuerySet[Badge]:
        qs = Badge.objects.filter(is_active=True)
        if category:
            qs = qs.filter(category=category)
        return qs.order_by("category", "name")

    @classmethod
    def get_user_transactions(
        cls, user: User, limit: int = 50
    ) -> QuerySet[ReputationTransaction]:
        return (
            ReputationTransaction.objects.filter(user=user)
            .select_related("community")
            .order_by("-created_at")[:limit]
        )

    @classmethod
    def get_global_leaderboard(
        cls, period: str = "all_time", limit: int = 50
    ) -> list[dict]:
        """
        Computes leaderboard entries ranked by total points or period transactions.
        """
        if period == "all_time":
            reps = (
                UserReputation.objects.select_related("user")
                .filter(user__is_active=True)
                .order_by("-total_points")[:limit]
            )
            entries = []
            for rank, rep in enumerate(reps, start=1):
                entries.append(
                    {
                        "rank": rank,
                        "user": rep.user,
                        "points": rep.total_points,
                        "level": rep.level,
                        "rank_title": rep.rank_title,
                    }
                )
            return entries

        # Period calculation (monthly or weekly)
        now = timezone.now()
        since = (
            now - timedelta(days=7)
            if period == "weekly"
            else now - timedelta(days=30)
        )

        aggregated = (
            ReputationTransaction.objects.filter(created_at__gte=since)
            .values("user_id")
            .annotate(period_points=Sum("points"))
            .order_by("-period_points")[:limit]
        )

        user_ids = [item["user_id"] for item in aggregated]
        users = {u.id: u for u in User.objects.filter(id__in=user_ids)}
        reps = {
            r.user_id: r for r in UserReputation.objects.filter(user_id__in=user_ids)
        }

        entries = []
        for rank, item in enumerate(aggregated, start=1):
            uid = item["user_id"]
            user = users.get(uid)
            if not user:
                continue
            rep = reps.get(uid)
            entries.append(
                {
                    "rank": rank,
                    "user": user,
                    "points": item["period_points"],
                    "level": rep.level if rep else 1,
                    "rank_title": rep.rank_title if rep else "Initié",
                }
            )
        return entries

    @classmethod
    def get_community_leaderboard(
        cls, community: Community, limit: int = 50
    ) -> list[dict]:
        """
        Computes leaderboard specific to a community based on community transactions.
        """
        aggregated = (
            ReputationTransaction.objects.filter(community=community)
            .values("user_id")
            .annotate(community_points=Sum("points"))
            .order_by("-community_points")[:limit]
        )

        user_ids = [item["user_id"] for item in aggregated]
        users = {u.id: u for u in User.objects.filter(id__in=user_ids)}
        reps = {
            r.user_id: r for r in UserReputation.objects.filter(user_id__in=user_ids)
        }

        entries = []
        for rank, item in enumerate(aggregated, start=1):
            uid = item["user_id"]
            user = users.get(uid)
            if not user:
                continue
            rep = reps.get(uid)
            entries.append(
                {
                    "rank": rank,
                    "user": user,
                    "points": item["community_points"],
                    "level": rep.level if rep else 1,
                    "rank_title": rep.rank_title if rep else "Initié",
                }
            )
        return entries
