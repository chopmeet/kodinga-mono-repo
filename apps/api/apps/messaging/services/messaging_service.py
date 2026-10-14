from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.messaging.models.attachment import MessageAttachment
from apps.messaging.models.conversation import Conversation, ConversationType
from apps.messaging.models.message import Message
from apps.messaging.models.participant import (
    ConversationParticipant,
    ParticipantRole,
)
from apps.notifications.models.notification import NotificationType
from apps.notifications.services.notification_service import NotificationService


class MessagingService:
    """
    Business logic for conversations, participants, and messaging.
    """

    @classmethod
    @transaction.atomic
    def start_direct_conversation(cls, user1, user2):
        if user1.id == user2.id:
            raise ValidationError("Impossible de démarrer une conversation privée avec soi-même.")

        # Check existing direct conversation
        existing = (
            Conversation.objects.filter(conversation_type=ConversationType.DIRECT)
            .filter(participants__user=user1)
            .filter(participants__user=user2)
            .first()
        )
        if existing:
            return existing, False

        conversation = Conversation.objects.create(
            conversation_type=ConversationType.DIRECT,
            created_by=user1,
            last_message_at=timezone.now(),
        )
        ConversationParticipant.objects.create(
            conversation=conversation,
            user=user1,
            role=ParticipantRole.MEMBER,
            last_read_at=timezone.now(),
        )
        ConversationParticipant.objects.create(
            conversation=conversation,
            user=user2,
            role=ParticipantRole.MEMBER,
            last_read_at=timezone.now(),
        )
        return conversation, True

    @classmethod
    @transaction.atomic
    def create_group_conversation(cls, creator, title, participants_users, community=None):
        if not title:
            raise ValidationError("Le titre du groupe est obligatoire.")

        conversation = Conversation.objects.create(
            conversation_type=ConversationType.GROUP,
            title=title,
            created_by=creator,
            community=community,
            last_message_at=timezone.now(),
        )
        ConversationParticipant.objects.create(
            conversation=conversation,
            user=creator,
            role=ParticipantRole.ADMIN,
            last_read_at=timezone.now(),
        )

        for user in participants_users:
            if user.id != creator.id:
                ConversationParticipant.objects.get_or_create(
                    conversation=conversation,
                    user=user,
                    defaults={"role": ParticipantRole.MEMBER, "last_read_at": timezone.now()},
                )

        return conversation

    @classmethod
    @transaction.atomic
    def send_message(cls, conversation, sender, content, attachments_data=None):
        participant = ConversationParticipant.objects.filter(
            conversation=conversation, user=sender
        ).first()
        if not participant:
            raise PermissionDenied("Vous ne faites pas partie de cette conversation.")

        if not content and not attachments_data:
            raise ValidationError("Le message ne peut pas être vide.")

        message = Message.objects.create(
            conversation=conversation,
            sender=sender,
            content=content or "",
        )

        if attachments_data:
            for item in attachments_data:
                MessageAttachment.objects.create(
                    message=message,
                    file_url=item.get("file_url"),
                    file_name=item.get("file_name", "attachment"),
                    file_size=item.get("file_size", 0),
                    content_type=item.get("content_type", ""),
                )

        now = timezone.now()
        conversation.last_message_at = now
        conversation.save(update_fields=["last_message_at"])

        participant.last_read_at = now
        participant.save(update_fields=["last_read_at"])

        # Notify other participants
        other_participants = conversation.participants.exclude(user=sender).select_related("user")
        preview = (content[:50] + "...") if content and len(content) > 50 else (content or "a envoyé une pièce jointe")
        for p in other_participants:
            NotificationService.create_notification(
                recipient=p.user,
                title=f"Nouveau message de {sender.username}",
                body=preview,
                notification_type=NotificationType.SYSTEM,
                actor=sender,
                action_url=f"/messages/{conversation.id}",
                metadata={"conversation_id": str(conversation.id), "message_id": str(message.id)},
            )

        return message

    @classmethod
    def mark_as_read(cls, conversation, user):
        participant = ConversationParticipant.objects.filter(
            conversation=conversation, user=user
        ).first()
        if participant:
            participant.last_read_at = timezone.now()
            participant.save(update_fields=["last_read_at"])
            return True
        return False

    @classmethod
    def edit_message(cls, message, user, new_content):
        if message.sender_id != user.id:
            raise PermissionDenied("Vous ne pouvez modifier que vos propres messages.")
        if message.is_deleted:
            raise ValidationError("Impossible de modifier un message supprimé.")
        if not new_content:
            raise ValidationError("Le contenu du message ne peut pas être vide.")

        message.content = new_content
        message.is_edited = True
        message.save(update_fields=["content", "is_edited", "updated_at"])
        return message

    @classmethod
    def delete_message(cls, message, user):
        if message.sender_id != user.id:
            # Check if user is group admin
            participant = ConversationParticipant.objects.filter(
                conversation=message.conversation, user=user
            ).first()
            if not participant or participant.role != ParticipantRole.ADMIN:
                raise PermissionDenied("Vous n'êtes pas autorisé à supprimer ce message.")

        message.is_deleted = True
        message.content = "[Ce message a été supprimé]"
        message.deleted_at = timezone.now()
        message.save(update_fields=["is_deleted", "content", "deleted_at", "updated_at"])
        return message
