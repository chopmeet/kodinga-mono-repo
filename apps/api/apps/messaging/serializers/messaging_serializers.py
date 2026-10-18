from rest_framework import serializers

from apps.accounts.models.user import User
from apps.messaging.models.attachment import MessageAttachment
from apps.messaging.models.conversation import Conversation
from apps.messaging.models.message import Message
from apps.messaging.models.participant import (
    ConversationParticipant,
)


class MessageAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageAttachment
        fields = ["id", "file_url", "file_name", "file_size", "content_type", "created_at"]


class MessageSenderSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "avatar_url"]

    def get_avatar_url(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.avatar_url if profile else ""


class MessageSerializer(serializers.ModelSerializer):
    sender = MessageSenderSerializer(read_only=True)
    attachments = MessageAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation_id",
            "sender",
            "content",
            "is_edited",
            "is_deleted",
            "is_pinned",
            "deleted_at",
            "attachments",
            "created_at",
            "updated_at",
        ]


class ConversationParticipantSerializer(serializers.ModelSerializer):
    user = MessageSenderSerializer(read_only=True)

    class Meta:
        model = ConversationParticipant
        fields = ["id", "user", "role", "joined_at", "last_read_at"]


class ConversationListSerializer(serializers.ModelSerializer):
    participants = ConversationParticipantSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "conversation_type",
            "title",
            "community_id",
            "last_message_at",
            "participants",
            "last_message",
            "unread_count",
            "created_at",
        ]

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by("-created_at").first()
        if last_msg:
            return {
                "id": str(last_msg.id),
                "sender_username": last_msg.sender.username,
                "content": last_msg.content,
                "created_at": last_msg.created_at,
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        from apps.messaging.selectors.messaging_selector import MessagingSelector
        return MessagingSelector.get_unread_count_for_conversation(obj, request.user)


class StartDirectConversationSerializer(serializers.Serializer):
    recipient_id = serializers.UUIDField(required=True)


class CreateGroupConversationSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=True)
    participant_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )
    community_id = serializers.UUIDField(required=False, allow_null=True)


class SendMessageSerializer(serializers.Serializer):
    content = serializers.CharField(required=False, allow_blank=True, default="")
    attachments = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )
