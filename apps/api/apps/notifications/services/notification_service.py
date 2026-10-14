import logging
from typing import Any, Optional

from django.utils import timezone

from apps.accounts.models.user import User
from apps.notifications.models.notification import Notification, NotificationType

logger = logging.getLogger("kodinga.notifications")


class NotificationService:
    """
    Centralized service for dispatching, reading and managing developer
    in-app notifications.
    """

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
            return notification
        except Exception as exc:
            logger.error(
                f"Failed to create notification for {recipient.username}: {exc}"
            )
            return None

    @classmethod
    def mark_as_read(cls, notification_id: str, user: User) -> bool:
        updated = Notification.objects.filter(
            id=notification_id, recipient=user, is_read=False
        ).update(is_read=True, read_at=timezone.now(), updated_at=timezone.now())
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
        deleted_count, _ = Notification.objects.filter(
            id=notification_id, recipient=user
        ).delete()
        return deleted_count > 0
