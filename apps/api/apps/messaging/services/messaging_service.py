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
from common.permissions.base import is_superadmin_user


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
        from realtime.broadcast import broadcast_conversation_created

        broadcast_conversation_created(
            conversation, participant_ids=[str(user1.id), str(user2.id)]
        )
        return conversation, True

    @classmethod
    @transaction.atomic
    def create_group_conversation(
        cls, creator, title, participants_users, community=None
    ):
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
                    defaults={
                        "role": ParticipantRole.MEMBER,
                        "last_read_at": timezone.now(),
                    },
                )

        from realtime.broadcast import broadcast_conversation_created

        all_ids = [str(creator.id)] + [
            str(u.id) for u in participants_users if u.id != creator.id
        ]
        broadcast_conversation_created(
            conversation, participant_ids=all_ids
        )

        return conversation

    @classmethod
    @transaction.atomic
    def send_message(cls, conversation, sender, content, attachments_data=None):
        participant = ConversationParticipant.objects.filter(
            conversation=conversation, user=sender
        ).first()
        if not participant:
            if is_superadmin_user(sender):
                participant = ConversationParticipant.objects.create(
                    conversation=conversation,
                    user=sender,
                    role=ParticipantRole.ADMIN
                )
            else:
                raise PermissionDenied("Vous ne faites pas partie de cette conversation.")

        if conversation.community:
            settings = getattr(conversation.community, "settings", None)
            if settings and settings.is_read_only and not is_superadmin_user(sender):
                is_owner = conversation.community.owner_id == sender.id
                from apps.memberships.models.member import (
                    CommunityMember,
                    MembershipStatus,
                )

                membership = CommunityMember.objects.filter(
                    community=conversation.community,
                    user=sender,
                    status=MembershipStatus.ACTIVE,
                ).first()
                if not (is_owner or (membership and membership.is_moderator)):
                    raise PermissionDenied(
                        "Cette communauté est en mode lecture seule. Seul le propriétaire ou un administrateur peut envoyer des messages."
                    )

        if not content and not attachments_data:
            raise ValidationError("Le message ne peut pas être vide.")

        # Mandatory pre-publication content moderation
        if content:
            from apps.ai.services.moderation_service import ModerationService
            ModerationService.enforce_pre_publication(
                content, community=conversation.community, author=sender
            )

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

        from realtime.broadcast import broadcast_message_created

        participant_ids = list(
            conversation.participants.values_list("user_id", flat=True)
        )
        broadcast_message_created(message, participant_ids=participant_ids)

        return message

    @classmethod
    def mark_as_read(cls, conversation, user):
        participant = ConversationParticipant.objects.filter(
            conversation=conversation, user=user
        ).first()
        if participant:
            participant.last_read_at = timezone.now()
            participant.save(update_fields=["last_read_at"])
            from realtime.broadcast import broadcast_message_read

            broadcast_message_read(
                conversation.id, user.id, participant.last_read_at
            )
            return True
        return False

    @classmethod
    def edit_message(cls, message, user, new_content):
        if not is_superadmin_user(user) and message.sender_id != user.id:
            raise PermissionDenied("Vous ne pouvez modifier que vos propres messages.")
        if message.is_deleted:
            raise ValidationError("Impossible de modifier un message supprimé.")
        if not new_content:
            raise ValidationError("Le contenu du message ne peut pas être vide.")

        message.content = new_content
        message.is_edited = True
        message.save(update_fields=["content", "is_edited", "updated_at"])

        from realtime.broadcast import broadcast_message_updated

        broadcast_message_updated(message)
        return message

    @classmethod
    def delete_message(cls, message, user):
        if not is_superadmin_user(user) and message.sender_id != user.id:
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

        from realtime.broadcast import broadcast_message_deleted

        broadcast_message_deleted(message.conversation_id, message.id)
        return message

    @classmethod
    def toggle_message_pin(cls, message, user):
        conversation = message.conversation
        is_allowed = False
        if is_superadmin_user(user):
            is_allowed = True
        elif conversation.community:
            if conversation.community.owner_id == user.id:
                is_allowed = True
            else:
                from apps.memberships.models.member import (
                    CommunityMember,
                    MembershipStatus,
                )

                membership = CommunityMember.objects.filter(
                    community=conversation.community,
                    user=user,
                    status=MembershipStatus.ACTIVE,
                ).first()
                if membership and membership.is_moderator:
                    is_allowed = True
        elif conversation.created_by_id == user.id:
            is_allowed = True
        else:
            participant = ConversationParticipant.objects.filter(
                conversation=conversation, user=user
            ).first()
            if participant and participant.role == ParticipantRole.ADMIN:
                is_allowed = True

        if not is_allowed:
            raise PermissionDenied("Seul le propriétaire ou un modérateur peut épingler un message.")

        message.is_pinned = not message.is_pinned
        message.save(update_fields=["is_pinned", "updated_at"])

        from realtime.broadcast import broadcast_message_pinned

        broadcast_message_pinned(
            message.conversation_id, message.id, message.is_pinned
        )
        return message.is_pinned
