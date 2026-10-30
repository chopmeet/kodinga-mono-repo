import math
from datetime import timedelta
from typing import Any, Optional

from django.db.models import Count, Min, Q, QuerySet, Sum
from django.utils import timezone

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.gamification.models.badge import Badge, UserBadge
from apps.gamification.models.reputation import (
    CommunityPointRule,
    CommunityPointRuleAuditLog,
    ReputationAction,
    ReputationTransaction,
    UserReputation,
    compute_level_and_rank,
)
from apps.gamification.services.gamification_service import GamificationService
from apps.memberships.models.member import CommunityMember, MembershipStatus


class GamificationSelector:
    """
    Query selectors for gamification profiles, point histories,
    community point rules, community statistics, and leaderboards.
    """

    @classmethod
    def get_user_reputation(cls, user: User) -> UserReputation:
        rep, _ = UserReputation.objects.get_or_create(
            user=user,
            defaults={"total_points": 0, "level": 1, "rank_title": "Initié"},
        )
        return rep

    @classmethod
    def get_user_badges(
        cls, user: User, community: Optional[Community] = None
    ) -> QuerySet[UserBadge]:
        qs = UserBadge.objects.filter(user=user).select_related(
            "badge", "community"
        )
        if community is not None:
            qs = qs.filter(community=community)
        return qs.order_by("-awarded_at")

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
        cls,
        user: User,
        limit: Optional[int] = 50,
        community: Optional[Community] = None,
        action: Optional[str] = None,
        source: Optional[str] = None,
    ) -> QuerySet[ReputationTransaction]:
        qs = ReputationTransaction.objects.filter(user=user).select_related(
            "user", "user__profile", "community", "awarded_by"
        )
        if community is not None:
            qs = qs.filter(community=community)
        if action:
            qs = qs.filter(action=action)
        if source:
            qs = qs.filter(source=source)
        qs = qs.order_by("-created_at")
        if limit is not None:
            return qs[:limit]
        return qs

    @classmethod
    def get_community_transactions(
        cls,
        community: Community,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        source: Optional[str] = None,
    ) -> QuerySet[ReputationTransaction]:
        """
        Returns all reputation transactions (automatic and manual adjustments)
        within a specific community, ordered from newest to oldest.
        """
        qs = ReputationTransaction.objects.filter(
            community=community
        ).select_related("user", "user__profile", "community", "awarded_by")
        if user_id:
            qs = qs.filter(user_id=user_id)
        if action:
            qs = qs.filter(action=action)
        if source:
            qs = qs.filter(source=source)
        return qs.order_by("-created_at")

    # =========================================================================
    # COMMUNITY POINT RULES & AUDIT HISTORY
    # =========================================================================
    @classmethod
    def get_community_rules(
        cls, community: Community
    ) -> list[CommunityPointRule]:
        return GamificationService.ensure_community_rules(community)

    @classmethod
    def get_community_rule_audit_logs(
        cls, community: Community, action: Optional[str] = None
    ) -> QuerySet[CommunityPointRuleAuditLog]:
        qs = CommunityPointRuleAuditLog.objects.filter(
            community=community
        ).select_related("changed_by", "rule", "community")
        if action:
            qs = qs.filter(action=action)
        return qs.order_by("-created_at")

    # =========================================================================
    # GLOBAL LEADERBOARD
    # =========================================================================
    @classmethod
    def get_global_leaderboard(
        cls, period: str = "all_time", limit: int = 50
    ) -> list[dict[str, Any]]:
        """
        Computes global leaderboard entries ranked by total points or period transactions.
        Handles ties consistently using standard competition ranking (1, 1, 3).
        """
        if period == "all_time":
            reps = list(
                UserReputation.objects.select_related("user", "user__profile")
                .filter(user__is_active=True)
                .order_by("-total_points", "created_at", "user__username")[:limit]
            )
            point_counts: dict[int, int] = {}
            for r in reps:
                point_counts[r.total_points] = (
                    point_counts.get(r.total_points, 0) + 1
                )

            entries: list[dict[str, Any]] = []
            prev_points: Optional[int] = None
            current_rank = 1
            for position, rep in enumerate(reps, start=1):
                if prev_points is not None and rep.total_points < prev_points:
                    current_rank = position
                prev_points = rep.total_points
                entries.append(
                    {
                        "rank": current_rank,
                        "position": position,
                        "is_tied": point_counts.get(rep.total_points, 0) > 1,
                        "user": rep.user,
                        "points": rep.total_points,
                        "level": rep.level,
                        "rank_title": rep.rank_title,
                        "activities_count": 0,
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

        aggregated = list(
            ReputationTransaction.objects.filter(created_at__gte=since)
            .values("user_id")
            .annotate(
                period_points=Sum("points"),
                activities_count=Count("id"),
                earliest_at=Min("created_at"),
            )
            .order_by("-period_points", "earliest_at")[:limit]
        )

        user_ids = [item["user_id"] for item in aggregated]
        users = {
            u.id: u
            for u in User.objects.filter(id__in=user_ids).select_related(
                "profile"
            )
        }
        reps = {
            r.user_id: r
            for r in UserReputation.objects.filter(user_id__in=user_ids)
        }

        point_counts = {}
        for item in aggregated:
            pts = int(item["period_points"] or 0)
            point_counts[pts] = point_counts.get(pts, 0) + 1

        entries = []
        prev_points = None
        current_rank = 1
        for position, item in enumerate(aggregated, start=1):
            uid = item["user_id"]
            user = users.get(uid)
            if not user:
                continue
            pts = int(item["period_points"] or 0)
            if prev_points is not None and pts < prev_points:
                current_rank = position
            prev_points = pts

            rep = reps.get(uid)
            entries.append(
                {
                    "rank": current_rank,
                    "position": position,
                    "is_tied": point_counts.get(pts, 0) > 1,
                    "user": user,
                    "points": pts,
                    "level": rep.level if rep else 1,
                    "rank_title": rep.rank_title if rep else "Initié",
                    "activities_count": int(item["activities_count"] or 0),
                }
            )
        return entries

    # =========================================================================
    # COMMUNITY LEADERBOARD (ISOLATED PER COMMUNITY, TIES, TOP N & PAGINATION)
    # =========================================================================
    @classmethod
    def _compute_full_community_ranking(
        cls,
        community: Community,
        period: str = "all_time",
        include_all_members: bool = False,
    ) -> list[dict[str, Any]]:
        """
        Computes the full ordered ranking of members for `community`, strictly
        isolated from other communities.
        Tie-breaking rule:
        1. Total community points DESC (`-community_points`)
        2. Earliest point achievement timestamp ASC (`earliest_at`)
        3. Username alphabetical ASC (`user__username`)
        Members with identical points share the same `rank` (Competition Ranking 1, 1, 3),
        while `position` is their 1-based row index (1, 2, 3).
        """
        tx_filter = Q(community=community)
        if period in ("weekly", "monthly"):
            now = timezone.now()
            since = (
                now - timedelta(days=7)
                if period == "weekly"
                else now - timedelta(days=30)
            )
            tx_filter &= Q(created_at__gte=since)

        aggregated = list(
            ReputationTransaction.objects.filter(tx_filter)
            .values("user_id")
            .annotate(
                community_points=Sum("points"),
                activities_count=Count("id"),
                earliest_at=Min("created_at"),
            )
        )

        tx_by_user_id: dict[Any, dict[str, Any]] = {
            item["user_id"]: item for item in aggregated
        }

        if include_all_members:
            member_qs = CommunityMember.objects.filter(
                community=community, status=MembershipStatus.ACTIVE
            ).values("user_id", "joined_at")
            for m in member_qs:
                uid = m["user_id"]
                if uid not in tx_by_user_id:
                    tx_by_user_id[uid] = {
                        "user_id": uid,
                        "community_points": 0,
                        "activities_count": 0,
                        "earliest_at": m["joined_at"],
                    }

        all_user_ids = list(tx_by_user_id.keys())
        if not all_user_ids:
            return []

        users = {
            u.id: u
            for u in User.objects.filter(
                id__in=all_user_ids, is_active=True
            ).select_related("profile")
        }
        memberships = {
            m.user_id: m
            for m in CommunityMember.objects.filter(
                community=community, user_id__in=all_user_ids
            )
        }

        raw_rows: list[dict[str, Any]] = []
        for uid, data in tx_by_user_id.items():
            user = users.get(uid)
            if not user:
                continue
            pts = int(data["community_points"] or 0)
            earliest = data.get("earliest_at") or user.date_joined
            raw_rows.append(
                {
                    "user": user,
                    "points": pts,
                    "activities_count": int(data.get("activities_count") or 0),
                    "earliest_at": earliest,
                    "membership": memberships.get(uid),
                }
            )

        # Deterministic sort: points DESC, earliest_at ASC, username ASC
        raw_rows.sort(
            key=lambda r: (
                -r["points"],
                r["earliest_at"].timestamp() if r["earliest_at"] else float("inf"),
                r["user"].username.lower(),
            )
        )

        # Count occurrences of each point value for `is_tied`
        point_counts: dict[int, int] = {}
        for r in raw_rows:
            point_counts[r["points"]] = point_counts.get(r["points"], 0) + 1

        ranked_entries: list[dict[str, Any]] = []
        prev_points: Optional[int] = None
        current_rank = 1

        for position, row in enumerate(raw_rows, start=1):
            pts = row["points"]
            if prev_points is not None and pts < prev_points:
                current_rank = position
            prev_points = pts

            level, rank_title = compute_level_and_rank(pts)
            membership = row["membership"]

            ranked_entries.append(
                {
                    "rank": current_rank,
                    "position": position,
                    "is_tied": point_counts.get(pts, 0) > 1,
                    "user": row["user"],
                    "points": pts,
                    "level": level,
                    "rank_title": rank_title,
                    "activities_count": row["activities_count"],
                    "role": membership.role if membership else None,
                    "custom_title": membership.custom_title if membership else "",
                }
            )

        return ranked_entries

    @classmethod
    def get_community_leaderboard(
        cls,
        community: Community,
        limit: int = 50,
        period: str = "all_time",
        include_all_members: bool = False,
    ) -> list[dict[str, Any]]:
        """
        Backward-compatible selector returning the top `limit` ranked entries
        for a community.
        """
        full_ranking = cls._compute_full_community_ranking(
            community=community,
            period=period,
            include_all_members=include_all_members,
        )
        return full_ranking[:limit]

    @classmethod
    def get_community_leaderboard_paginated(
        cls,
        community: Community,
        top: Optional[int] = None,
        limit: Optional[int] = None,
        page: int = 1,
        page_size: int = 50,
        period: str = "all_time",
        include_all_members: bool = False,
        current_user: Optional[User] = None,
    ) -> dict[str, Any]:
        """
        Returns paginated community leaderboard entries along with metadata
        and the authenticated member's own rank/position.
        """
        full_ranking = cls._compute_full_community_ranking(
            community=community,
            period=period,
            include_all_members=include_all_members,
        )

        # Find current user's position before slicing
        current_user_entry = None
        if current_user and current_user.is_authenticated:
            for entry in full_ranking:
                if entry["user"].id == current_user.id:
                    current_user_entry = entry
                    break
            if current_user_entry is None:
                # Authenticated user has 0 points in this community
                lvl, title = compute_level_and_rank(0)
                current_user_entry = {
                    "rank": None,
                    "position": None,
                    "is_tied": False,
                    "user": current_user,
                    "points": 0,
                    "level": lvl,
                    "rank_title": title,
                    "activities_count": 0,
                }

        total_ranked = len(full_ranking)

        # Apply top preset (e.g., Top 3, Top 10, Top 100) or limit if specified
        effective_cap = top or limit
        working_list = (
            full_ranking[:effective_cap]
            if effective_cap is not None
            else full_ranking
        )

        total_items = len(working_list)
        page = max(1, int(page or 1))
        page_size = max(1, min(int(page_size or 50), 100))
        total_pages = max(1, math.ceil(total_items / page_size)) if total_items > 0 else 1

        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_entries = working_list[start_idx:end_idx]

        return {
            "entries": page_entries,
            "current_user_entry": current_user_entry,
            "meta": {
                "community_id": str(community.id),
                "community_slug": community.slug,
                "period": period,
                "top": top,
                "total_ranked_members": total_ranked,
                "count": total_items,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_previous": page > 1,
            },
        }

    @classmethod
    def get_member_leaderboard_position(
        cls,
        community: Community,
        user: User,
        period: str = "all_time",
    ) -> dict[str, Any]:
        """
        Computes a specific member's position in the community leaderboard,
        points needed to reach the next rank, and surrounding leaderboard entries.
        """
        full_ranking = cls._compute_full_community_ranking(
            community=community,
            period=period,
            include_all_members=True,
        )
        total_ranked = len(full_ranking)

        target_idx: Optional[int] = None
        target_entry: Optional[dict[str, Any]] = None
        for idx, entry in enumerate(full_ranking):
            if entry["user"].id == user.id:
                target_idx = idx
                target_entry = entry
                break

        if target_entry is None:
            lvl, title = compute_level_and_rank(0)
            return {
                "community_id": str(community.id),
                "community_slug": community.slug,
                "rank": None,
                "position": None,
                "is_tied": False,
                "points": 0,
                "level": lvl,
                "rank_title": title,
                "activities_count": 0,
                "total_ranked_members": total_ranked,
                "points_to_next_rank": (
                    max(1, full_ranking[-1]["points"] + 1)
                    if full_ranking
                    else 1
                ),
                "surrounding_entries": [],
            }

        # Calculate points needed to overtake the next higher distinct rank
        points_to_next_rank = 0
        assert target_idx is not None
        for higher_idx in range(target_idx - 1, -1, -1):
            higher_pts = full_ranking[higher_idx]["points"]
            if higher_pts > target_entry["points"]:
                points_to_next_rank = (higher_pts - target_entry["points"]) + 1
                break

        start_s = max(0, target_idx - 1)
        end_s = min(total_ranked, target_idx + 2)
        surrounding = full_ranking[start_s:end_s]

        return {
            "community_id": str(community.id),
            "community_slug": community.slug,
            "rank": target_entry["rank"],
            "position": target_entry["position"],
            "is_tied": target_entry["is_tied"],
            "points": target_entry["points"],
            "level": target_entry["level"],
            "rank_title": target_entry["rank_title"],
            "activities_count": target_entry["activities_count"],
            "total_ranked_members": total_ranked,
            "points_to_next_rank": points_to_next_rank,
            "surrounding_entries": surrounding,
        }

    # =========================================================================
    # MEMBER COMMUNITY POINTS SUMMARY & COMMUNITY GAMIFICATION STATS
    # =========================================================================
    @classmethod
    def get_member_community_points(
        cls, user: User, community: Community
    ) -> dict[str, Any]:
        """
        Returns the total points, level, leaderboard rank, and breakdown by activity
        for `user` inside `community`.
        """
        tx_qs = ReputationTransaction.objects.filter(
            community=community, user=user
        )
        agg = tx_qs.aggregate(
            total_points=Sum("points"),
            transactions_count=Count("id"),
        )
        total_points = int(agg["total_points"] or 0)
        transactions_count = int(agg["transactions_count"] or 0)
        level, rank_title = compute_level_and_rank(total_points)

        breakdown_qs = (
            tx_qs.values("action")
            .annotate(
                total_points=Sum("points"),
                count=Count("id"),
            )
            .order_by("-total_points")
        )
        action_labels = dict(ReputationAction.choices)
        breakdown = [
            {
                "action": item["action"],
                "action_label": action_labels.get(
                    item["action"], item["action"]
                ),
                "points": int(item["total_points"] or 0),
                "count": int(item["count"] or 0),
            }
            for item in breakdown_qs
        ]

        pos_info = cls.get_member_leaderboard_position(
            community=community, user=user
        )

        return {
            "user": user,
            "community_id": str(community.id),
            "community_slug": community.slug,
            "community_name": community.name,
            "total_points": total_points,
            "level": level,
            "rank_title": rank_title,
            "rank": pos_info["rank"],
            "position": pos_info["position"],
            "is_tied": pos_info["is_tied"],
            "total_ranked_members": pos_info["total_ranked_members"],
            "points_to_next_rank": pos_info["points_to_next_rank"],
            "transactions_count": transactions_count,
            "breakdown_by_action": breakdown,
        }

    @classmethod
    def get_community_gamification_stats(
        cls, community: Community
    ) -> dict[str, Any]:
        """
        Computes global gamification statistics for a community:
        total points awarded, active rewarded members, breakdown by activity,
        and Top 3 leaderboard preview.
        """
        tx_qs = ReputationTransaction.objects.filter(community=community)
        overall = tx_qs.aggregate(
            total_points_awarded=Sum("points"),
            positive_points_awarded=Sum("points", filter=Q(points__gt=0)),
            manual_adjustments_net=Sum(
                "points", filter=Q(action=ReputationAction.MANUAL_ADJUSTMENT)
            ),
            total_transactions_count=Count("id"),
            active_rewarded_members_count=Count("user_id", distinct=True),
        )

        total_points_awarded = int(overall["total_points_awarded"] or 0)
        positive_points_awarded = int(overall["positive_points_awarded"] or 0)
        manual_adjustments_net = int(overall["manual_adjustments_net"] or 0)
        total_transactions_count = int(overall["total_transactions_count"] or 0)
        active_rewarded_members_count = int(
            overall["active_rewarded_members_count"] or 0
        )

        total_community_members_count = CommunityMember.objects.filter(
            community=community, status=MembershipStatus.ACTIVE
        ).count()

        avg_points = (
            round(total_points_awarded / active_rewarded_members_count, 1)
            if active_rewarded_members_count > 0
            else 0.0
        )

        action_labels = dict(ReputationAction.choices)
        breakdown_qs = (
            tx_qs.values("action")
            .annotate(
                total_points=Sum("points"),
                transactions_count=Count("id"),
                unique_members_count=Count("user_id", distinct=True),
            )
            .order_by("-total_points")
        )
        breakdown_by_action = [
            {
                "action": item["action"],
                "action_label": action_labels.get(
                    item["action"], item["action"]
                ),
                "total_points": int(item["total_points"] or 0),
                "transactions_count": int(item["transactions_count"] or 0),
                "unique_members_count": int(item["unique_members_count"] or 0),
            }
            for item in breakdown_qs
        ]

        top_3 = cls.get_community_leaderboard(community=community, limit=3)

        return {
            "community_id": str(community.id),
            "community_slug": community.slug,
            "community_name": community.name,
            "total_points_awarded": total_points_awarded,
            "positive_points_awarded": positive_points_awarded,
            "manual_adjustments_net": manual_adjustments_net,
            "total_transactions_count": total_transactions_count,
            "active_rewarded_members_count": active_rewarded_members_count,
            "total_community_members_count": total_community_members_count,
            "average_points_per_rewarded_member": avg_points,
            "breakdown_by_action": breakdown_by_action,
            "top_3_members": top_3,
        }
