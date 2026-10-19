from rest_framework.exceptions import PermissionDenied

from apps.messaging.models.conversation import Conversation
from apps.messaging.models.message import Message


class MessagingSelector:
    """
    Optimized queries for conversations and messages.
    """

    @classmethod
    def get_user_conversations(cls, user):
        """
        Returns all conversations where user is participant,
        ordered by most recent message, with participants prefetched.
        """
        return (
            Conversation.objects.filter(participants__user=user)
            .select_related("created_by", "community")
            .prefetch_related("participants__user__profile", "messages")
            .distinct()
            .order_by("-last_message_at")
        )

    @classmethod
    def get_conversation_detail(cls, conversation_id, user):
        conversation = (
            Conversation.objects.filter(id=conversation_id)
            .select_related("created_by", "community")
            .prefetch_related("participants__user__profile")
            .first()
        )
        if not conversation:
            return None

        from common.permissions.base import is_superadmin_user
        is_participant = conversation.participants.filter(user=user).exists()
        if not is_participant and not is_superadmin_user(user):
            raise PermissionDenied("Vous n'avez pas accès à cette conversation.")

        return conversation

    @classmethod
    def get_conversation_messages(cls, conversation, user, since=None):
        from common.permissions.base import is_superadmin_user

        is_participant = conversation.participants.filter(user=user).exists()
        if not is_participant and not is_superadmin_user(user):
            raise PermissionDenied("Vous n'avez pas accès à cette conversation.")

        qs = (
            Message.objects.filter(conversation=conversation)
            .select_related("sender__profile")
            .prefetch_related("attachments")
            .order_by("created_at")
        )
        if since is not None:
            qs = qs.filter(created_at__gt=since)
        return qs

    @classmethod
    def get_pinned_messages(cls, conversation, user):
        return cls.get_conversation_messages(conversation, user).filter(is_pinned=True)

    @classmethod
    def get_unread_count_for_conversation(cls, conversation, user):
        participant = conversation.participants.filter(user=user).first()
        if not participant:
            return 0
        return (
            Message.objects.filter(conversation=conversation, created_at__gt=participant.last_read_at)
            .exclude(sender=user)
            .count()
        )
