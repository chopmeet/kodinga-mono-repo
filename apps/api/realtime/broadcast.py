import asyncio
import logging
import time
import uuid
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

logger = logging.getLogger("kodinga.realtime")


def create_event_envelope(event_type: str, data: dict[str, Any]) -> dict[str, Any]:
    """
    Standard Kodinga Realtime v1 event envelope.
    """
    return {
        "v": 1,
        "type": event_type,
        "event_id": str(uuid.uuid4()),
        "ts": int(time.time()),
        "data": data,
    }


def send_group_event(
    group_name: str,
    event_type: str,
    data: dict[str, Any],
    sender_channel: str | None = None,
) -> None:
    """
    Safely dispatches an event to a single Channels group after the current DB transaction commits.
    Catches and logs any channel layer errors to guarantee zero regression on REST transactions.
    """
    envelope = create_event_envelope(event_type, data)

    def _execute():
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    group_name,
                    {
                        "type": "event_broadcast",
                        "sender_channel": sender_channel,
                        "payload": envelope,
                    },
                )
        except Exception as e:
            logger.warning(
                f"[REALTIME BROADCAST ERROR] Could not send {event_type} to group {group_name}: {e}"
            )

    try:
        transaction.on_commit(_execute)
    except Exception:
        _execute()


def send_groups_event(
    group_names: list[str],
    event_type: str,
    data: dict[str, Any],
    sender_channel: str | None = None,
) -> None:
    """
    Safely dispatches an event to multiple Channels groups concurrently after the current DB transaction commits.
    """
    if not group_names:
        return
    envelope = create_event_envelope(event_type, data)

    def _execute():
        try:
            channel_layer = get_channel_layer()
            if not channel_layer:
                return

            unique_groups = set(group_names)
            payload = {
                "type": "event_broadcast",
                "sender_channel": sender_channel,
                "payload": envelope,
            }

            async def _send_all():
                coros = [
                    channel_layer.group_send(group, payload)
                    for group in unique_groups
                ]
                await asyncio.gather(*coros, return_exceptions=True)

            async_to_sync(_send_all)()
        except Exception as e:
            logger.warning(
                f"[REALTIME BROADCAST ERROR] Could not send {event_type} to groups {group_names}: {e}"
            )

    try:
        transaction.on_commit(_execute)
    except Exception:
        _execute()


# =====================================================================
# Direct Messaging Events
# =====================================================================


def broadcast_message_created(message, participant_ids: list[str] | None = None):
    """
    Broadcasts a newly created message to:
    1. conversation_{conversation_id} (active chat participants)
    2. user_{participant_id} (for participants to update badges/sidebar previews)
    """
    from apps.messaging.serializers.messaging_serializers import (
        MessageSerializer,
    )

    data = MessageSerializer(message).data
    conversation_group = f"conversation_{message.conversation_id}"
    send_group_event(conversation_group, "message.created", data)

    # Sidebar/badge updates for participants
    if participant_ids is None and hasattr(message, "conversation"):
        participant_ids = list(
            message.conversation.participants.values_list("user_id", flat=True)
        )

    if participant_ids:
        preview_data = {
            "conversation_id": str(message.conversation_id),
            "last_message": {
                "id": str(message.id),
                "sender_username": getattr(message.sender, "username", ""),
                "content": message.content,
                "created_at": (
                    message.created_at.isoformat()
                    if hasattr(message.created_at, "isoformat")
                    else str(message.created_at)
                ),
            },
            "message": data,
        }
        user_groups = [f"user_{uid}" for uid in participant_ids]
        send_groups_event(user_groups, "conversation.message_preview", preview_data)


def broadcast_message_updated(message):
    """
    Broadcasts message edits to conversation_{conversation_id}.
    """
    from apps.messaging.serializers.messaging_serializers import (
        MessageSerializer,
    )

    data = MessageSerializer(message).data
    send_group_event(
        f"conversation_{message.conversation_id}", "message.updated", data
    )


def broadcast_message_deleted(conversation_id: str, message_id: str):
    """
    Broadcasts soft/hard message deletion to conversation_{conversation_id}.
    """
    data = {
        "conversation_id": str(conversation_id),
        "message_id": str(message_id),
    }
    send_group_event(f"conversation_{conversation_id}", "message.deleted", data)


def broadcast_message_pinned(
    conversation_id: str, message_id: str, is_pinned: bool
):
    """
    Broadcasts message pin/unpin toggles to conversation_{conversation_id}.
    """
    data = {
        "conversation_id": str(conversation_id),
        "message_id": str(message_id),
        "is_pinned": bool(is_pinned),
    }
    send_group_event(f"conversation_{conversation_id}", "message.pinned", data)


def broadcast_message_read(conversation_id: str, user_id: str, last_read_at):
    """
    Broadcasts read receipts to conversation_{conversation_id}.
    """
    data = {
        "conversation_id": str(conversation_id),
        "user_id": str(user_id),
        "last_read_at": (
            last_read_at.isoformat()
            if hasattr(last_read_at, "isoformat")
            else str(last_read_at)
        ),
    }
    send_group_event(f"conversation_{conversation_id}", "message.read", data)


def broadcast_conversation_created(
    conversation, participant_ids: list[str] | None = None
):
    """
    Broadcasts new conversation creation to each participant's user_{user_id} group.
    """
    from apps.messaging.serializers.messaging_serializers import (
        ConversationListSerializer,
    )

    data = ConversationListSerializer(conversation).data
    if participant_ids is None:
        participant_ids = list(
            conversation.participants.values_list("user_id", flat=True)
        )
    user_groups = [f"user_{uid}" for uid in participant_ids]
    send_groups_event(user_groups, "conversation.created", data)


# =====================================================================
# Posts & Feed Events
# =====================================================================


def broadcast_post_created(post):
    """
    Broadcasts newly created post to community_{community_id}.
    """
    from apps.posts.serializers.post import PostListSerializer

    data = PostListSerializer(post).data
    send_group_event(f"community_{post.community_id}", "post.created", data)


def broadcast_post_updated(post):
    """
    Broadcasts post edits to community_{community_id} and post_{post_id}.
    """
    from apps.posts.serializers.post import PostDetailSerializer

    data = PostDetailSerializer(post).data
    groups = [f"community_{post.community_id}", f"post_{post.id}"]
    send_groups_event(groups, "post.updated", data)


def broadcast_post_deleted(community_id: str, post_id: str):
    """
    Broadcasts post deletion to community_{community_id} and post_{post_id}.
    """
    data = {
        "community_id": str(community_id),
        "post_id": str(post_id),
    }
    groups = [f"community_{community_id}", f"post_{post_id}"]
    send_groups_event(groups, "post.deleted", data)


def broadcast_post_pinned(community_id: str, post_id: str, is_pinned: bool):
    """
    Broadcasts post pin toggles to community_{community_id}.
    """
    data = {
        "community_id": str(community_id),
        "post_id": str(post_id),
        "is_pinned": bool(is_pinned),
    }
    send_group_event(f"community_{community_id}", "post.pinned", data)


def broadcast_post_locked(community_id: str, post_id: str, is_locked: bool):
    """
    Broadcasts post lock toggles to community_{community_id} and post_{post_id}.
    """
    data = {
        "community_id": str(community_id),
        "post_id": str(post_id),
        "is_locked": bool(is_locked),
    }
    groups = [f"community_{community_id}", f"post_{post_id}"]
    send_groups_event(groups, "post.locked", data)


def broadcast_post_reaction(
    community_id: str,
    post_id: str,
    reaction_type: str,
    reactions_count: int,
    user_id: str,
    action: str,
):
    """
    Broadcasts post reaction additions/removals.
    action: "added" | "removed"
    """
    data = {
        "community_id": str(community_id),
        "post_id": str(post_id),
        "reaction_type": reaction_type,
        "reactions_count": reactions_count,
        "user_id": str(user_id),
        "action": action,
    }
    groups = [f"community_{community_id}", f"post_{post_id}"]
    send_groups_event(groups, "post.reaction", data)


# =====================================================================
# Comments Events
# =====================================================================


def broadcast_comment_created(comment):
    """
    Broadcasts new comment to post_{post_id} and updates comments count on community_{community_id}.
    """
    from apps.posts.serializers.comment import CommentSerializer

    data = CommentSerializer(comment).data
    send_group_event(f"post_{comment.post_id}", "comment.created", data)

    # Inform feed about comments_count update
    if hasattr(comment, "post") and comment.post:
        post = comment.post
        count_data = {
            "community_id": str(post.community_id),
            "post_id": str(post.id),
            "comments_count": getattr(post, "comments_count", 0),
            "comment": data,
        }
        send_group_event(
            f"community_{post.community_id}", "post.comments_count", count_data
        )


def broadcast_comment_updated(comment):
    """
    Broadcasts comment edits to post_{post_id}.
    """
    from apps.posts.serializers.comment import CommentSerializer

    data = CommentSerializer(comment).data
    send_group_event(f"post_{comment.post_id}", "comment.updated", data)


def broadcast_comment_deleted(
    post_id: str,
    comment_id: str,
    community_id: str | None = None,
    new_comments_count: int | None = None,
):
    """
    Broadcasts comment deletion to post_{post_id} and updates comments_count if provided.
    """
    data = {
        "post_id": str(post_id),
        "comment_id": str(comment_id),
    }
    send_group_event(f"post_{post_id}", "comment.deleted", data)

    if community_id is not None and new_comments_count is not None:
        count_data = {
            "community_id": str(community_id),
            "post_id": str(post_id),
            "comments_count": new_comments_count,
        }
        send_group_event(
            f"community_{community_id}", "post.comments_count", count_data
        )


def broadcast_comment_reaction(
    post_id: str,
    comment_id: str,
    reaction_type: str,
    reactions_count: int,
    user_id: str,
    action: str,
):
    """
    Broadcasts comment reaction additions/removals to post_{post_id}.
    """
    data = {
        "post_id": str(post_id),
        "comment_id": str(comment_id),
        "reaction_type": reaction_type,
        "reactions_count": reactions_count,
        "user_id": str(user_id),
        "action": action,
    }
    send_group_event(f"post_{post_id}", "comment.reaction", data)


def broadcast_comment_accepted(
    post_id: str, comment_id: str, is_accepted: bool
):
    """
    Broadcasts Q&A accepted answer changes to post_{post_id}.
    """
    data = {
        "post_id": str(post_id),
        "comment_id": str(comment_id),
        "is_accepted": bool(is_accepted),
    }
    send_group_event(f"post_{post_id}", "comment.accepted", data)


# =====================================================================
# Events & Hackathons Registration Counter Broadcasts (BE-05)
# =====================================================================


def broadcast_event_registration_updated(
    event,
    user_id: str | None = None,
    status: str | None = None,
):
    """
    Broadcasts updated event registration counter to community_{community_id}.
    """
    data = {
        "community_id": str(event.community_id),
        "event_id": str(event.id),
        "event_slug": event.slug,
        "attendees_count": event.attendees_count,
        "max_attendees": event.max_attendees,
        "is_full": event.is_full,
        "user_id": str(user_id) if user_id else None,
        "status": status,
    }
    send_group_event(
        f"community_{event.community_id}", "event.registration_updated", data
    )


def broadcast_hackathon_registration_updated(
    hackathon,
    user_id: str | None = None,
    status: str | None = None,
):
    """
    Broadcasts updated hackathon registration counters to community_{community_id}.
    """
    data = {
        "community_id": str(hackathon.community_id),
        "hackathon_id": str(hackathon.id),
        "hackathon_slug": hackathon.slug,
        "participants_count": hackathon.participants_count,
        "applications_count": hackathon.applications_count,
        "max_participants": hackathon.max_participants,
        "is_registration_open": hackathon.is_registration_open,
        "user_id": str(user_id) if user_id else None,
        "status": status,
    }
    send_group_event(
        f"community_{hackathon.community_id}",
        "hackathon.registration_updated",
        data,
    )


# =====================================================================
# Notifications Events
# =====================================================================


def broadcast_notification_created(notification):
    """
    Broadcasts real-time notification to user_{user_id}.
    """
    from apps.notifications.serializers.notification_serializer import (
        NotificationSerializer,
    )

    data = NotificationSerializer(notification).data
    recipient_id = getattr(notification, "recipient_id", None) or getattr(
        notification, "user_id", None
    )
    send_group_event(f"user_{recipient_id}", "notification.created", data)
