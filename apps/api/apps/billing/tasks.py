import logging
from datetime import timedelta

from apps.billing.models.subscription import Subscription, SubscriptionStatus
from apps.communities.models.community import CommunityPricing
from apps.memberships.models.member import CommunityMember, MembershipStatus
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger('kodinga.billing.tasks')


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def check_and_expire_subscriptions(self) -> dict:
    """
    Periodic task to revoke access for expired subscriptions:
    1. Sets status of past-due subscriptions to EXPIRED.
    2. Revokes/suspends active CommunityMember access if the user has no remaining valid subscription
       to that paid community (excluding the community owner).
    """
    now = timezone.now()
    logger.info(f"[Billing Tasks] Checking expired subscriptions at {now}...")

    expired_subs = Subscription.objects.select_related('community', 'user', 'plan').filter(
        status=SubscriptionStatus.ACTIVE,
        current_period_end__lt=now
    )

    expired_count = 0
    suspended_members_count = 0

    for sub in expired_subs:
        sub.status = SubscriptionStatus.EXPIRED
        sub.save(update_fields=['status', 'updated_at'])
        expired_count += 1
        logger.info(f"[Billing Tasks] Subscription {sub.id} (User: {sub.user.username}, Plan: {sub.plan.name}) expired.")

        # If community plan, check if membership should be suspended
        if sub.community:
            community = sub.community
            user = sub.user

            # Never suspend the community owner
            if community.owner_id == user.id:
                continue

            # Free communities do not require active subscriptions
            if community.pricing_type == CommunityPricing.FREE:
                continue

            # Check if user has another valid active subscription for this community
            has_other_active = Subscription.objects.filter(
                community=community,
                user=user,
                status=SubscriptionStatus.ACTIVE,
                current_period_end__gt=now
            ).exists()

            if not has_other_active:
                updated = CommunityMember.objects.filter(
                    community=community,
                    user=user,
                    status=MembershipStatus.ACTIVE
                ).update(status=MembershipStatus.SUSPENDED)
                if updated:
                    from apps.communities.models.community import Community
                    from django.db.models import F
                    Community.objects.filter(id=community.id, members_count__gt=0).update(
                        members_count=F('members_count') - 1
                    )
                    suspended_members_count += updated
                    logger.info(f"[Billing Tasks] Suspended membership of User {user.username} in Community {community.name} due to subscription expiration.")

    logger.info(f"[Billing Tasks] Finished. Expired {expired_count} subscriptions, suspended {suspended_members_count} community memberships.")
    return {
        'expired_subscriptions': expired_count,
        'suspended_memberships': suspended_members_count
    }


@shared_task(bind=True, max_retries=2, default_retry_delay=120)
def send_subscription_expiry_reminders(self) -> dict:
    """
    Periodic task to identify subscriptions expiring within 72 hours
    and dispatch renewal alerts to users.
    """
    now = timezone.now()
    window_start = now + timedelta(days=3)
    window_end = now + timedelta(days=4)

    expiring_subs = Subscription.objects.select_related('user', 'plan', 'community').filter(
        status=SubscriptionStatus.ACTIVE,
        current_period_end__gte=window_start,
        current_period_end__lte=window_end
    )

    reminded_count = 0
    for sub in expiring_subs:
        # User notification logic / renewal link dispatch
        logger.info(f"[Billing Tasks] Sending renewal reminder for User {sub.user.username} (Subscription {sub.id})")
        reminded_count += 1

    return {'reminded_count': reminded_count}
