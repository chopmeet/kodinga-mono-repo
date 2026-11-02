from apps.accounts.models.user import User
from apps.notifications.models.notification import Notification
from django.db.models import QuerySet


class NotificationSelector:
    """
    Optimized queries for developer notifications.
    """

    @classmethod
    def get_user_notifications(
        cls, user: User, unread_only: bool = False
    ) -> QuerySet[Notification]:
        qs = (
            Notification.objects.filter(recipient=user)
            .select_related("actor")
            .order_by("-created_at")
        )
        if unread_only:
            qs = qs.filter(is_read=False)
        return qs

    @classmethod
    def get_unread_count(cls, user: User) -> int:
        return Notification.objects.filter(recipient=user, is_read=False).count()
