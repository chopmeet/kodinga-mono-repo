from django.db.models import Count, Q
from rest_framework.exceptions import PermissionDenied

from apps.messaging.models.conversation import Conversation
from apps.messaging.models.message import Message
from apps.messaging.models.participant import ConversationParticipant


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

        is_participant = conversation.participants.filter(user=user).exists()
        if not is_participant:
            raise PermissionDenied("Vous n'avez pas accès à cette conversation.")

        return conversation

    @classmethod
    def get_conversation_messages(cls, conversation, user):
        is_participant = conversation.participants.filter(user=user).exists()
        if not is_participant:
            raise PermissionDenied("Vous n'avez pas accès à cette conversation.")

        return (
            Message.objects.filter(conversation=conversation)
            .select_related("sender__profile")
            .prefetch_related("attachments")
            .order_by("created_at")
        )

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
