import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from apps.billing.models.subscription import Subscription, SubscriptionStatus
from apps.communities.models.community import CommunityPricing
from apps.memberships.models.member import CommunityMember, MembershipStatus

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
                    from django.db.models import F

                    from apps.communities.models.community import Community
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
    from django.conf import settings

    from apps.notifications.models.notification import Notification, NotificationType
    from apps.notifications.services.notification_service import NotificationService

    for sub in expiring_subs:
        reminder_tag = f"expiry_reminder_{sub.id}_{sub.current_period_end.date().isoformat()}"
        already_notified = Notification.objects.filter(
            recipient=sub.user,
            target_type="subscription",
            target_id=str(sub.id),
            metadata__reminder_tag=reminder_tag,
        ).exists()
        if already_notified:
            continue

        days_left = max(1, (sub.current_period_end - now).days)
        plan_name = sub.plan.name if sub.plan else "Abonnement"
        community_name = sub.community.name if sub.community else "Kodinga Pro"
        title = f"Rappel : votre abonnement expire dans {days_left} jour{'s' if days_left > 1 else ''}"
        body = (
            f"Votre abonnement '{plan_name}' pour {community_name} arrive à échéance le "
            f"{sub.current_period_end.strftime('%d/%m/%Y')}. Pensez à le renouveler pour conserver vos accès."
        )
        action_url = f"/c/{sub.community.slug}/billing" if sub.community else "/settings/billing"

        NotificationService.create_notification(
            recipient=sub.user,
            title=title,
            body=body,
            notification_type=NotificationType.SYSTEM,
            action_url=action_url,
            target_type="subscription",
            target_id=str(sub.id),
            metadata={"reminder_tag": reminder_tag, "expires_at": sub.current_period_end.isoformat()},
        )

        if sub.user.email:
            try:
                from apps.accounts.services.email import EmailService

                frontend_url = getattr(settings, 'FRONTEND_URL', 'https://kodinga.me').rstrip('/')
                EmailService.send_mail(
                    to_email=sub.user.email,
                    subject=f"[Kodinga] {title}",
                    message=(
                        f"Bonjour {sub.user.username},\n\n{body}\n\n"
                        f"Pour renouveler, rendez-vous sur : {frontend_url}{action_url}\n\n"
                        "L'équipe Kodinga"
                    ),
                )
            except Exception as e:
                logger.error(f"[Billing Tasks] Failed to send reminder email to {sub.user.email}: {e}")

        logger.info(f"[Billing Tasks] Sent renewal reminder for User {sub.user.username} (Subscription {sub.id})")
        reminded_count += 1

    return {'reminded_count': reminded_count}
