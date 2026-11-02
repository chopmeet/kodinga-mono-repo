from apps.messaging.models.attachment import MessageAttachment
from apps.messaging.models.conversation import Conversation
from apps.messaging.models.message import Message
from apps.messaging.models.participant import ConversationParticipant
from django.contrib import admin


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ["id", "conversation_type", "title", "created_by", "last_message_at"]
    list_filter = ["conversation_type"]


@admin.register(ConversationParticipant)
class ConversationParticipantAdmin(admin.ModelAdmin):
    list_display = ["id", "conversation", "user", "role", "joined_at", "last_read_at"]
    search_fields = ["user__username", "user__email"]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["id", "conversation", "sender", "is_edited", "is_deleted", "created_at"]
    search_fields = ["content", "sender__username"]


@admin.register(MessageAttachment)
class MessageAttachmentAdmin(admin.ModelAdmin):
    list_display = ["id", "message", "file_name", "file_size", "content_type"]
