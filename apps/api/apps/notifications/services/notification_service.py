import logging
from typing import Any, Optional

from apps.accounts.models.user import User
from apps.notifications.models.notification import Notification, NotificationType
from common.permissions.base import is_superadmin_user
from django.utils import timezone

logger = logging.getLogger("kodinga.notifications")


class NotificationService:
    """
    Centralized service for dispatching, reading and managing developer
    in-app notifications.
    """

    CONTENT_LABELS = {
        "course": ("Formation", NotificationType.COURSE_NEW),
        "hackathon": ("Hackathon", NotificationType.HACKATHON_NEW),
        "project": ("Projet", NotificationType.PROJECT_NEW),
        "opportunity": ("Opportunité", NotificationType.OPPORTUNITY_NEW),
    }

    @classmethod
    def create_notification(
        cls,
        recipient: User,
        title: str,
        body: str,
        notification_type: str = NotificationType.SYSTEM,
        actor: Optional[User] = None,
        action_url: str = "",
        target_type: str = "",
        target_id: str = "",
        metadata: Optional[dict[str, Any]] = None,
    ) -> Optional[Notification]:
        """
        Creates an in-app notification. Skips self-notifications if actor == recipient.
        """
        if actor and actor.id == recipient.id:
            return None

        try:
            notification = Notification.objects.create(
                recipient=recipient,
                actor=actor,
                notification_type=notification_type,
                title=title.strip(),
                body=body.strip(),
                action_url=action_url.strip(),
                target_type=target_type.strip(),
                target_id=str(target_id).strip(),
                metadata=metadata or {},
            )
            from realtime.broadcast import broadcast_notification_created

            broadcast_notification_created(notification)
            return notification
        except Exception as exc:
            logger.error(
                f"Failed to create notification for {recipient.username}: {exc}"
            )
            return None

    @classmethod
    def notify_community_content_published(
        cls,
        community,
        actor: Optional[User],
        content_type: str,
        content_id: str,
        title: str,
        action_url: str,
    ) -> int:
        """
        Dispatches publication notifications to all active members of `community`
        for one of the 4 supported content types: course, hackathon, project, opportunity.
        Guarantees idempotency so a single content item is never notified twice.
        """
        if not community or not content_id:
            return 0

        normalized_type = content_type.strip().lower()
        target_id_str = str(content_id).strip()

        # Prevent duplicate notifications for the same published content
        if Notification.objects.filter(
            target_type=normalized_type,
            target_id=target_id_str,
        ).exists():
            return 0

        label, notif_type = cls.CONTENT_LABELS.get(
            normalized_type, ("Contenu", NotificationType.CONTENT_PUBLISHED)
        )

        from apps.memberships.models.member import CommunityMember, MembershipStatus

        members = (
            CommunityMember.objects.filter(
                community=community,
                status=MembershipStatus.ACTIVE,
                notifications_enabled=True,
            )
            .select_related("user")
        )

        recipients: dict[Any, User] = {}
        for member in members:
            recipients[member.user_id] = member.user

        # Check if owner has explicitly disabled notifications
        owner_membership = CommunityMember.objects.filter(
            community=community,
            user_id=community.owner_id
        ).first()
        if getattr(community, "owner", None) and (not owner_membership or owner_membership.notifications_enabled):
            recipients[community.owner_id] = community.owner

        if actor and actor.id in recipients:
            recipients.pop(actor.id, None)

        notif_title = f"Nouveau {label.lower()} publié : {title}"
        if normalized_type in ("course", "opportunity"):
            notif_title = f"Nouvelle {label.lower()} publiée : {title}"

        notif_body = (
            f"{label} « {title} » est maintenant disponible dans la communauté "
            f"{community.name}."
        )
        metadata = {
            "community_id": str(community.id),
            "community_slug": community.slug,
            "content_type": normalized_type,
            "content_id": target_id_str,
            "content_title": title,
            "action_url": action_url,
        }

        dispatched = 0
        for recipient in recipients.values():
            created = cls.create_notification(
                recipient=recipient,
                actor=actor,
                title=notif_title,
                body=notif_body,
                notification_type=notif_type,
                action_url=action_url,
                target_type=normalized_type,
                target_id=target_id_str,
                metadata=metadata,
            )
            if created is not None:
                dispatched += 1
        return dispatched

    @classmethod
    def mark_as_read(cls, notification_id: str, user: User) -> bool:
        qs = Notification.objects.filter(id=notification_id, is_read=False)
        if not is_superadmin_user(user):
            qs = qs.filter(recipient=user)
        updated = qs.update(is_read=True, read_at=timezone.now(), updated_at=timezone.now())
        return bool(updated)

    @classmethod
    def mark_all_as_read(cls, user: User) -> int:
        now = timezone.now()
        count = Notification.objects.filter(
            recipient=user, is_read=False
        ).update(is_read=True, read_at=now, updated_at=now)
        return count

    @classmethod
    def delete_notification(cls, notification_id: str, user: User) -> bool:
        qs = Notification.objects.filter(id=notification_id)
        if not is_superadmin_user(user):
            qs = qs.filter(recipient=user)
        deleted_count, _ = qs.delete()
        return deleted_count > 0
