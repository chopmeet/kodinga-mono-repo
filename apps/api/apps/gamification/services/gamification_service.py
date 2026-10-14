import logging
from typing import Optional

from django.db import transaction
from django.utils import timezone

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.gamification.models.badge import Badge, UserBadge
from apps.gamification.models.reputation import (
    ACTION_DEFAULT_POINTS,
    ReputationAction,
    ReputationTransaction,
    UserReputation,
)

logger = logging.getLogger("kodinga.gamification")


class GamificationService:
    """
    Business logic for reputation point attribution, level progression
    and achievement badge unlocks.
    """

    @classmethod
    def ensure_reputation(cls, user: User) -> UserReputation:
        rep, _ = UserReputation.objects.get_or_create(
            user=user,
            defaults={"total_points": 0, "level": 1, "rank_title": "Initié"},
        )
        return rep

    @classmethod
    def award_points(
        cls,
        user: User,
        action: str,
        points: Optional[int] = None,
        community: Optional[Community] = None,
        description: str = "",
    ) -> tuple[UserReputation, ReputationTransaction]:
        """
        Atomically records a reputation point transaction and updates developer level.
        """
        pts = points if points is not None else ACTION_DEFAULT_POINTS.get(action, 0)

        with transaction.atomic():
            rep, _ = UserReputation.objects.select_for_update().get_or_create(
                user=user,
                defaults={"total_points": 0, "level": 1, "rank_title": "Initié"},
            )

            # Record transaction
            desc = description or dict(ReputationAction.choices).get(action, action)
            tx = ReputationTransaction.objects.create(
                user=user,
                community=community,
                action=action,
                points=pts,
                description=desc,
            )

            # Update reputation and streak
            rep.total_points += pts
            today = timezone.now().date()
            if rep.last_activity_date != today:
                if (
                    rep.last_activity_date
                    and (today - rep.last_activity_date).days == 1
                ):
                    rep.current_streak_days += 1
                elif not rep.last_activity_date or (
                    today - rep.last_activity_date
                ).days > 1:
                    rep.current_streak_days = 1
                rep.last_activity_date = today

            rep.update_level_and_rank()
            rep.save()

            # Automatic milestone badge check
            cls.check_milestones(user, rep)

            return rep, tx

    @classmethod
    def award_badge(
        cls,
        user: User,
        badge_slug: str,
        community: Optional[Community] = None,
    ) -> Optional[UserBadge]:
        """
        Unlocks a badge for a user, rewards XP bonus and generates a notification.
        """
        try:
            badge = Badge.objects.get(slug=badge_slug, is_active=True)
        except Badge.DoesNotExist:
            logger.warning(f"Badge '{badge_slug}' introuvable.")
            return None

        with transaction.atomic():
            user_badge, created = UserBadge.objects.get_or_create(
                user=user,
                badge=badge,
                community=community,
            )
            if not created:
                return user_badge

            # Reward bonus XP if configured
            if badge.points_reward > 0:
                cls.award_points(
                    user=user,
                    action=ReputationAction.BADGE_UNLOCKED,
                    points=badge.points_reward,
                    community=community,
                    description=f"Badge débloqué : {badge.name}",
                )

            # Notify user
            try:
                from apps.notifications.services.notification_service import (
                    NotificationService,
                )

                NotificationService.create_notification(
                    recipient=user,
                    title="Nouveau badge débloqué ! 🏆",
                    body=f"Félicitations, vous avez obtenu le badge « {badge.name} » !",
                    notification_type="badge_unlocked",
                    action_url="/profile/badges",
                    target_type="badge",
                    target_id=str(badge.id),
                )
            except Exception as e:
                logger.debug(
                    f"Notification non envoyée pour le badge {badge.name}: {e}"
                )

            return user_badge

    @classmethod
    def check_milestones(cls, user: User, reputation: UserReputation) -> None:
        """
        Checks automatic thresholds and awards corresponding milestone badges.
        """
        if reputation.total_points >= 100:
            cls.award_badge(user, "century-club")
        if reputation.total_points >= 500:
            cls.award_badge(user, "community-pillar")
        if reputation.level >= 5:
            cls.award_badge(user, "code-master")
        if reputation.current_streak_days >= 7:
            cls.award_badge(user, "streak-week")
