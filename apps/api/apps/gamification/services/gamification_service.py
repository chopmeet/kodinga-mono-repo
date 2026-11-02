import logging
from typing import Any, Optional

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.gamification.models.badge import Badge, UserBadge
from apps.gamification.models.reputation import (
    ACTION_DEFAULT_POINTS,
    CATALOG_BY_ACTION,
    REWARDABLE_ACTIVITIES_CATALOG,
    CommunityPointRule,
    CommunityPointRuleAuditLog,
    ReputationAction,
    ReputationTransaction,
    TransactionSource,
    UserReputation,
)
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from common.permissions.base import is_superadmin_user
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

logger = logging.getLogger("kodinga.gamification")


class GamificationService:
    """
    Centralized business logic for:
    - Configurable per-community point rules (barème) & rule change audit logging
    - Idempotent automatic point attribution from domain events (courses, events, feed posts, etc.)
    - Manual point adjustments with mandatory reason and immutable audit trail
    - Developer level progression and achievement badge unlocks
    """

    # =========================================================================
    # PERMISSIONS & ACCESS CONTROL
    # =========================================================================
    @classmethod
    def check_can_manage_gamification(
        cls, user: User, community: Community
    ) -> bool:
        """
        Verifies that `user` is the Community Owner, an authorized Community Admin,
        or a platform Superadmin. Raises PermissionDenied otherwise.
        """
        if not user or not user.is_authenticated:
            raise PermissionDenied("Authentification requise.")

        if is_superadmin_user(user) or community.owner_id == user.id:
            return True

        membership = CommunityMember.objects.filter(
            community=community,
            user=user,
            status=MembershipStatus.ACTIVE,
        ).first()

        if membership and membership.role == CommunityRole.OWNER:
            return True

        if membership and membership.role == CommunityRole.ADMIN:
            settings_obj = getattr(community, "settings", None)
            if settings_obj is None or settings_obj.has_permission(
                membership.role, "can_manage_settings"
            ):
                return True

        raise PermissionDenied(
            "Seul le propriétaire ou un administrateur autorisé de la communauté "
            "peut configurer le barème ou ajuster les points."
        )

    # =========================================================================
    # COMMUNITY POINT RULES (BARÈME PAR COMMUNAUTÉ)
    # =========================================================================
    @classmethod
    def ensure_community_rules(
        cls, community: Community
    ) -> list[CommunityPointRule]:
        """
        Ensures all rewardable activities from the catalog exist for `community`.
        Creates missing rules using default values without overwriting existing ones.
        """
        existing_rules = {
            r.action: r
            for r in CommunityPointRule.objects.filter(community=community)
        }
        to_create = []
        for item in REWARDABLE_ACTIVITIES_CATALOG:
            action_code = str(item["action"])
            if action_code not in existing_rules:
                to_create.append(
                    CommunityPointRule(
                        community=community,
                        action=action_code,
                        label=str(item["label"]),
                        description=str(item["description"]),
                        points=int(item["default_points"]),
                        is_active=bool(item["default_is_active"]),
                        allow_multiple_per_reference=bool(
                            item.get("allow_multiple_per_reference", False)
                        ),
                    )
                )
        if to_create:
            CommunityPointRule.objects.bulk_create(
                to_create, ignore_conflicts=True
            )

        return list(
            CommunityPointRule.objects.filter(community=community).order_by(
                "-points", "action"
            )
        )

    @classmethod
    def get_rule_for_action(
        cls, community: Optional[Community], action: str
    ) -> Optional[CommunityPointRule]:
        """
        Retrieves the community's point rule for `action`, initializing defaults if needed.
        """
        if community is None:
            return None

        rule = CommunityPointRule.objects.filter(
            community=community, action=action
        ).first()
        if rule is not None:
            return rule

        catalog_item = CATALOG_BY_ACTION.get(action)
        if catalog_item is None:
            return None

        rule, _ = CommunityPointRule.objects.get_or_create(
            community=community,
            action=action,
            defaults={
                "label": str(catalog_item["label"]),
                "description": str(catalog_item["description"]),
                "points": int(catalog_item["default_points"]),
                "is_active": bool(catalog_item["default_is_active"]),
                "allow_multiple_per_reference": bool(
                    catalog_item.get("allow_multiple_per_reference", False)
                ),
            },
        )
        return rule

    @classmethod
    def update_community_rule(
        cls,
        actor: User,
        community: Community,
        action: str,
        points: Optional[int] = None,
        is_active: Optional[bool] = None,
        allow_multiple_per_reference: Optional[bool] = None,
        note: str = "",
    ) -> CommunityPointRule:
        """
        Updates the points and/or active state of a reward rule for a community,
        and logs the change in CommunityPointRuleAuditLog.
        Does NOT retroactively recalculate existing member points.
        """
        cls.check_can_manage_gamification(actor, community)

        if action not in CATALOG_BY_ACTION:
            valid_actions = ", ".join(CATALOG_BY_ACTION.keys())
            raise ValidationError(
                {
                    "action": (
                        f"Activité '{action}' non reconnue ou non configurable. "
                        f"Activités valides : {valid_actions}."
                    )
                }
            )

        if points is not None and int(points) < 0:
            raise ValidationError(
                {"points": "Le nombre de points d'une règle ne peut pas être négatif."}
            )

        with transaction.atomic():
            cls.ensure_community_rules(community)
            rule = CommunityPointRule.objects.select_for_update().get(
                community=community, action=action
            )

            prev_points = rule.points
            prev_active = rule.is_active

            new_points = int(points) if points is not None else rule.points
            new_active = (
                bool(is_active) if is_active is not None else rule.is_active
            )

            changed = (prev_points != new_points) or (prev_active != new_active)

            rule.points = new_points
            rule.is_active = new_active
            if allow_multiple_per_reference is not None:
                rule.allow_multiple_per_reference = bool(
                    allow_multiple_per_reference
                )
            rule.updated_by = actor
            rule.save()

            if changed:
                CommunityPointRuleAuditLog.objects.create(
                    community=community,
                    rule=rule,
                    action=action,
                    changed_by=actor,
                    previous_points=prev_points,
                    new_points=new_points,
                    previous_is_active=prev_active,
                    new_is_active=new_active,
                    note=note.strip(),
                )

            return rule

    @classmethod
    def bulk_update_community_rules(
        cls,
        actor: User,
        community: Community,
        rules_data: list[dict[str, Any]],
        note: str = "",
    ) -> list[CommunityPointRule]:
        """
        Updates multiple community point rules atomically.
        """
        cls.check_can_manage_gamification(actor, community)

        if not isinstance(rules_data, list) or not rules_data:
            raise ValidationError(
                {"rules": "Veuillez fournir une liste non vide de règles à modifier."}
            )

        with transaction.atomic():
            cls.ensure_community_rules(community)
            for item in rules_data:
                action = item.get("action")
                if not action:
                    raise ValidationError(
                        {"action": "Le champ 'action' est requis pour chaque règle."}
                    )
                cls.update_community_rule(
                    actor=actor,
                    community=community,
                    action=str(action),
                    points=item.get("points"),
                    is_active=item.get("is_active"),
                    allow_multiple_per_reference=item.get(
                        "allow_multiple_per_reference"
                    ),
                    note=str(item.get("note") or note or ""),
                )

            return list(
                CommunityPointRule.objects.filter(community=community).order_by(
                    "-points", "action"
                )
            )

    # =========================================================================
    # CORE POINT ATTRIBUTION & IDEMPOTENCE
    # =========================================================================
    @classmethod
    def ensure_reputation(cls, user: User) -> UserReputation:
        rep, _ = UserReputation.objects.get_or_create(
            user=user,
            defaults={"total_points": 0, "level": 1, "rank_title": "Initié"},
        )
        return rep

    @classmethod
    def _build_idempotency_key(
        cls,
        user: User,
        action: str,
        community: Optional[Community],
        reference_type: str,
        reference_id: str,
    ) -> Optional[str]:
        if not reference_id:
            return None
        comm_part = str(community.id) if community else "global"
        ref_type_part = reference_type or "entity"
        return f"{comm_part}:{user.id}:{action}:{ref_type_part}:{reference_id}"

    @classmethod
    def _sync_community_and_profile_scores(
        cls,
        user: User,
        community: Optional[Community],
        global_total_points: int,
    ) -> None:
        """
        Synchronizes `CommunityMember.reputation_score` for `(community, user)`
        and `DeveloperProfile.reputation_points` for `user`.
        """
        if community is not None:
            comm_sum = (
                ReputationTransaction.objects.filter(
                    community=community, user=user
                ).aggregate(total=Sum("points"))["total"]
                or 0
            )
            CommunityMember.objects.filter(
                community=community, user=user
            ).update(reputation_score=max(0, int(comm_sum)))

        try:
            from apps.profiles.models.profile import DeveloperProfile

            DeveloperProfile.objects.filter(user=user).update(
                reputation_points=max(0, int(global_total_points))
            )
        except Exception:
            pass

    @classmethod
    def award_points(
        cls,
        user: User,
        action: str,
        points: Optional[int] = None,
        community: Optional[Community] = None,
        description: str = "",
        reference_type: str = "",
        reference_id: str = "",
        source: str = TransactionSource.AUTOMATIC,
        awarded_by: Optional[User] = None,
        allow_multiple: bool = False,
    ) -> tuple[UserReputation, Optional[ReputationTransaction]]:
        """
        Atomically records a reputation point transaction, enforces idempotence
        when `reference_id` is provided, and updates community & global reputation.

        - If `points` is omitted (`None`), looks up the community's configured
          `CommunityPointRule` (or `ACTION_DEFAULT_POINTS` fallback).
        - If the community rule is disabled (`is_active=False`) for an automatic
          attribution, no points are awarded and `(rep, None)` is returned.
        - If `reference_id` is provided and `allow_multiple` is False, ensures points
          are only awarded ONCE for `(user, community, action, reference_id)`.
        """
        rule: Optional[CommunityPointRule] = None
        if community is not None and action in CATALOG_BY_ACTION:
            rule = cls.get_rule_for_action(community, action)

        # If automatic attribution without explicit points override, check rule state
        if points is None:
            if rule is not None:
                if not rule.is_active or rule.points <= 0:
                    rep = cls.ensure_reputation(user)
                    return rep, None
                pts = int(rule.points)
            else:
                pts = int(ACTION_DEFAULT_POINTS.get(action, 0))
                if pts <= 0 and source == TransactionSource.AUTOMATIC:
                    rep = cls.ensure_reputation(user)
                    return rep, None
        else:
            # Even when called by domain helpers, if rule is explicitly disabled for automatic events
            if (
                source == TransactionSource.AUTOMATIC
                and rule is not None
                and not rule.is_active
                and reference_id
            ):
                rep = cls.ensure_reputation(user)
                return rep, None
            pts = int(points)

        effective_allow_multiple = allow_multiple or (
            bool(rule.allow_multiple_per_reference) if rule else False
        )
        if source == TransactionSource.MANUAL_ADJUSTMENT:
            effective_allow_multiple = True

        ref_id_str = str(reference_id).strip() if reference_id else ""
        ref_type_str = str(reference_type).strip() if reference_type else ""
        idempotency_key = (
            None
            if effective_allow_multiple
            else cls._build_idempotency_key(
                user=user,
                action=action,
                community=community,
                reference_type=ref_type_str,
                reference_id=ref_id_str,
            )
        )

        with transaction.atomic():
            rep, _ = UserReputation.objects.select_for_update().get_or_create(
                user=user,
                defaults={"total_points": 0, "level": 1, "rank_title": "Initié"},
            )

            # Idempotence check to prevent double attribution
            if idempotency_key:
                existing_tx = ReputationTransaction.objects.filter(
                    idempotency_key=idempotency_key
                ).first()
                if existing_tx is not None:
                    return rep, existing_tx

            if not effective_allow_multiple and ref_id_str:
                existing_by_ref = ReputationTransaction.objects.filter(
                    user=user,
                    community=community,
                    action=action,
                    reference_id=ref_id_str,
                ).first()
                if existing_by_ref is not None:
                    return rep, existing_by_ref

            desc = description or dict(ReputationAction.choices).get(
                action, action
            )
            try:
                tx = ReputationTransaction.objects.create(
                    user=user,
                    community=community,
                    action=action,
                    reference_type=ref_type_str,
                    reference_id=ref_id_str,
                    points=pts,
                    source=source,
                    awarded_by=awarded_by,
                    idempotency_key=idempotency_key,
                    description=desc[:255],
                )
            except IntegrityError:
                # Race condition fallback on unique idempotency_key
                existing_tx = ReputationTransaction.objects.filter(
                    idempotency_key=idempotency_key
                ).first()
                return rep, existing_tx

            # Update global reputation and streak
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

            # Sync community member reputation_score and developer profile points
            cls._sync_community_and_profile_scores(
                user=user,
                community=community,
                global_total_points=rep.total_points,
            )

            # Automatic milestone badge check
            cls.check_milestones(user, rep)

            return rep, tx

    # =========================================================================
    # AUTOMATIC BUSINESS EVENT TRIGGERS
    # =========================================================================
    @classmethod
    def award_course_completed(
        cls, user: User, course: Any
    ) -> tuple[UserReputation, Optional[ReputationTransaction]]:
        """
        Awards points when a member effectively completes a course (100% progress).
        Idempotent per (user, community, course.id).
        """
        community = getattr(course, "community", None)
        return cls.award_points(
            user=user,
            action=ReputationAction.COURSE_COMPLETED,
            points=None,  # Resolved from CommunityPointRule (default 50 pts)
            community=community,
            description=f"Formation terminée : {course.title}",
            reference_type="course",
            reference_id=str(course.id),
            source=TransactionSource.AUTOMATIC,
        )

    @classmethod
    def award_event_attended(
        cls, user: User, event: Any
    ) -> tuple[UserReputation, Optional[ReputationTransaction]]:
        """
        Awards points when a member's effective attendance at an event is confirmed.
        Idempotent per (user, community, event.id).
        """
        community = getattr(event, "community", None)
        return cls.award_points(
            user=user,
            action=ReputationAction.EVENT_ATTENDED,
            points=None,  # Resolved from CommunityPointRule (default 30 pts)
            community=community,
            description=f"Participation confirmée à l'événement : {event.title}",
            reference_type="event",
            reference_id=str(event.id),
            source=TransactionSource.AUTOMATIC,
        )

    @classmethod
    def award_post_created(
        cls, user: User, post: Any
    ) -> tuple[UserReputation, Optional[ReputationTransaction]]:
        """
        Awards points when a member publishes a valid post in the community feed.
        Idempotent per (user, community, post.id).
        """
        community = getattr(post, "community", None)
        title_preview = getattr(post, "title", "") or getattr(post, "content", "")[:50]
        return cls.award_points(
            user=user,
            action=ReputationAction.POST_CREATED,
            points=None,  # Resolved from CommunityPointRule (default 10 pts)
            community=community,
            description=f"Publication d'un post : {title_preview}".strip(),
            reference_type="post",
            reference_id=str(post.id),
            source=TransactionSource.AUTOMATIC,
        )

    @classmethod
    def award_accepted_answer(
        cls, user: User, comment: Any
    ) -> tuple[UserReputation, Optional[ReputationTransaction]]:
        """
        Awards points when a member's comment is marked as accepted answer.
        Idempotent per (user, community, comment.id).
        """
        post = getattr(comment, "post", None)
        community = getattr(post, "community", None) if post else None
        return cls.award_points(
            user=user,
            action=ReputationAction.ACCEPTED_ANSWER,
            points=None,  # Resolved from CommunityPointRule (default 15 pts)
            community=community,
            description="Réponse validée sur une question de la communauté",
            reference_type="comment",
            reference_id=str(comment.id),
            source=TransactionSource.AUTOMATIC,
        )

    @classmethod
    def award_lesson_completed(
        cls, user: User, lesson: Any
    ) -> tuple[UserReputation, Optional[ReputationTransaction]]:
        """
        Awards points when a member completes an individual lesson (if enabled in community rules).
        Idempotent per (user, community, lesson.id).
        """
        module = getattr(lesson, "module", None)
        course = getattr(module, "course", None) if module else None
        community = getattr(course, "community", None) if course else None
        return cls.award_points(
            user=user,
            action=ReputationAction.LESSON_COMPLETED,
            points=None,
            community=community,
            description=f"Leçon terminée : {lesson.title}",
            reference_type="lesson",
            reference_id=str(lesson.id),
            source=TransactionSource.AUTOMATIC,
        )

    @classmethod
    def award_comment_created(
        cls, user: User, comment: Any
    ) -> tuple[UserReputation, Optional[ReputationTransaction]]:
        """
        Awards points when a member posts a comment (if enabled in community rules).
        Idempotent per (user, community, comment.id).
        """
        post = getattr(comment, "post", None)
        community = getattr(post, "community", None) if post else None
        return cls.award_points(
            user=user,
            action=ReputationAction.COMMENT_CREATED,
            points=None,
            community=community,
            description="Commentaire publié dans la communauté",
            reference_type="comment",
            reference_id=str(comment.id),
            source=TransactionSource.AUTOMATIC,
        )

    @classmethod
    def award_hackathon_submitted(
        cls, user: User, submission: Any
    ) -> tuple[UserReputation, Optional[ReputationTransaction]]:
        """
        Awards points when a member submits a final hackathon project.
        Idempotent per (user, community, submission.id).
        """
        hackathon = getattr(submission, "hackathon", None)
        community = getattr(hackathon, "community", None) if hackathon else None
        return cls.award_points(
            user=user,
            action=ReputationAction.HACKATHON_SUBMITTED,
            points=None,
            community=community,
            description=f"Projet de hackathon soumis : {submission.title}",
            reference_type="hackathon_submission",
            reference_id=str(submission.id),
            source=TransactionSource.AUTOMATIC,
        )

    # =========================================================================
    # MANUAL POINT ADJUSTMENTS (ADMINISTRATION)
    # =========================================================================
    @classmethod
    def adjust_member_points(
        cls,
        actor: User,
        community: Community,
        target_user: User,
        points_delta: int,
        reason: str,
    ) -> tuple[UserReputation, ReputationTransaction]:
        """
        Allows the Community Owner or an authorized Admin to manually add or
        deduct points for a community member with a mandatory reason (`motif`).
        Creates an immutable transaction without modifying past transactions.
        """
        cls.check_can_manage_gamification(actor, community)

        if points_delta == 0:
            raise ValidationError(
                {
                    "points": "Le nombre de points à ajuster doit être différent de zéro (positif ou négatif)."
                }
            )

        cleaned_reason = (reason or "").strip()
        if not cleaned_reason:
            raise ValidationError(
                {"reason": "Un motif est obligatoire pour tout ajustement manuel de points."}
            )

        # Verify target user is linked to the community (owner or member)
        is_member = (
            community.owner_id == target_user.id
            or CommunityMember.objects.filter(
                community=community,
                user=target_user,
                status=MembershipStatus.ACTIVE,
            ).exists()
        )
        if not is_member:
            raise ValidationError(
                {
                    "user_id": "Cet utilisateur n'est pas un membre actif de cette communauté."
                }
            )

        rep, tx = cls.award_points(
            user=target_user,
            action=ReputationAction.MANUAL_ADJUSTMENT,
            points=int(points_delta),
            community=community,
            description=cleaned_reason,
            reference_type="manual",
            reference_id="",
            source=TransactionSource.MANUAL_ADJUSTMENT,
            awarded_by=actor,
            allow_multiple=True,
        )
        assert tx is not None
        return rep, tx

    # =========================================================================
    # BADGES & MILESTONES
    # =========================================================================
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
                    reference_type="badge",
                    reference_id=str(badge.id),
                    source=TransactionSource.BADGE_REWARD,
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
