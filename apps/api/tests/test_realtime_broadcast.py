from unittest.mock import MagicMock, patch

import pytest
from django.db import transaction

from apps.accounts.models.user import User
from apps.communities.models.community import Community, CommunityCategory
from apps.messaging.models.conversation import Conversation
from apps.messaging.models.message import Message
from apps.messaging.models.participant import ConversationParticipant
from apps.posts.models.comment import Comment
from apps.posts.models.post import Post
from realtime.broadcast import (
    broadcast_comment_created,
    broadcast_comment_deleted,
    broadcast_comment_reaction,
    broadcast_conversation_created,
    broadcast_message_created,
    broadcast_message_deleted,
    broadcast_message_pinned,
    broadcast_message_read,
    broadcast_message_updated,
    broadcast_notification_created,
    broadcast_post_created,
    broadcast_post_deleted,
    broadcast_post_reaction,
    broadcast_post_updated,
    create_event_envelope,
    send_group_event,
)


@pytest.fixture
def auth_user(db):
    return User.objects.create_user(
        username="alice",
        email="alice@example.com",
        password="password123",
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        username="bob",
        email="bob@example.com",
        password="password123",
    )


@pytest.fixture
def category(db):
    return CommunityCategory.objects.create(name="Tech", slug="tech")


@pytest.fixture
def community(db, auth_user, category):
    return Community.objects.create(
        name="Python Community",
        slug="python-community",
        owner=auth_user,
        category=category,
    )


@pytest.fixture
def conversation(db, auth_user, other_user):
    conv = Conversation.objects.create(conversation_type="direct")
    ConversationParticipant.objects.create(conversation=conv, user=auth_user)
    ConversationParticipant.objects.create(conversation=conv, user=other_user)
    return conv


@pytest.fixture
def message(db, conversation, auth_user):
    return Message.objects.create(
        conversation=conversation,
        sender=auth_user,
        content="Hello world",
    )


@pytest.fixture
def post(db, community, auth_user):
    return Post.objects.create(
        community=community,
        author=auth_user,
        title="Realtime Post",
        content="Exploring WebSockets",
    )


@pytest.fixture
def comment(db, post, auth_user):
    return Comment.objects.create(
        post=post,
        author=auth_user,
        content="Great post!",
    )


def test_create_event_envelope():
    envelope = create_event_envelope("test.event", {"foo": "bar"})
    assert envelope["v"] == 1
    assert envelope["type"] == "test.event"
    assert "event_id" in envelope
    assert "ts" in envelope
    assert envelope["data"] == {"foo": "bar"}


@pytest.mark.django_db(transaction=True)
def test_send_group_event_invokes_channel_layer(auth_user):
    with patch("realtime.broadcast.get_channel_layer") as mock_get_channel_layer:
        mock_layer = MagicMock()
        mock_get_channel_layer.return_value = mock_layer

        with transaction.atomic():
            send_group_event("test_group", "ping", {"hello": "world"})

        assert mock_layer.group_send.called
        call_args = mock_layer.group_send.call_args[0]
        assert call_args[0] == "test_group"
        assert call_args[1]["type"] == "event_broadcast"
        assert call_args[1]["payload"]["type"] == "ping"
        assert call_args[1]["payload"]["data"] == {"hello": "world"}


@pytest.mark.django_db(transaction=True)
def test_broadcast_does_not_fire_on_transaction_rollback():
    with patch("realtime.broadcast.get_channel_layer") as mock_get_channel_layer:
        mock_layer = MagicMock()
        mock_get_channel_layer.return_value = mock_layer

        try:
            with transaction.atomic():
                send_group_event("test_group", "should_rollback", {})
                raise ValueError("Simulated failure")
        except ValueError:
            pass

        assert not mock_layer.group_send.called


@pytest.mark.django_db(transaction=True)
def test_broadcast_safe_against_channel_layer_exceptions():
    with patch("realtime.broadcast.get_channel_layer") as mock_get_channel_layer:
        mock_layer = MagicMock()
        mock_layer.group_send.side_effect = RuntimeError("Redis down!")
        mock_get_channel_layer.return_value = mock_layer

        # Must not raise an exception
        send_group_event("test_group", "event", {})


@pytest.mark.django_db(transaction=True)
def test_broadcast_message_events(message, conversation, auth_user):
    with (
        patch("realtime.broadcast.send_group_event") as mock_send_single,
        patch("realtime.broadcast.send_groups_event") as mock_send_multi,
    ):
        # 1. Created
        broadcast_message_created(message)
        assert mock_send_single.called
        assert mock_send_multi.called

        # 2. Updated
        mock_send_single.reset_mock()
        broadcast_message_updated(message)
        assert mock_send_single.called
        assert mock_send_single.call_args[0][0] == f"conversation_{conversation.id}"
        assert mock_send_single.call_args[0][1] == "message.updated"

        # 3. Deleted
        mock_send_single.reset_mock()
        broadcast_message_deleted(conversation.id, message.id)
        assert mock_send_single.called
        assert mock_send_single.call_args[0][1] == "message.deleted"

        # 4. Pinned
        mock_send_single.reset_mock()
        broadcast_message_pinned(conversation.id, message.id, True)
        assert mock_send_single.called
        assert mock_send_single.call_args[0][1] == "message.pinned"
        assert mock_send_single.call_args[0][2]["is_pinned"] is True

        # 5. Read
        mock_send_single.reset_mock()
        broadcast_message_read(conversation.id, auth_user.id, "2026-10-19T00:00:00Z")
        assert mock_send_single.called
        assert mock_send_single.call_args[0][1] == "message.read"


@pytest.mark.django_db(transaction=True)
def test_broadcast_conversation_created(conversation, other_user):
    with patch("realtime.broadcast.send_groups_event") as mock_send_multi:
        broadcast_conversation_created(conversation)
        assert mock_send_multi.called
        groups = mock_send_multi.call_args[0][0]
        assert f"user_{other_user.id}" in groups
        assert mock_send_multi.call_args[0][1] == "conversation.created"


@pytest.mark.django_db(transaction=True)
def test_broadcast_post_and_comment_events(post, comment, community, auth_user):
    with (
        patch("realtime.broadcast.send_group_event") as mock_send_single,
        patch("realtime.broadcast.send_groups_event") as mock_send_multi,
    ):
        # Post created
        broadcast_post_created(post)
        assert mock_send_single.called
        assert mock_send_single.call_args[0][0] == f"community_{community.id}"
        assert mock_send_single.call_args[0][1] == "post.created"

        # Post updated
        broadcast_post_updated(post)
        assert mock_send_multi.called
        assert f"community_{community.id}" in mock_send_multi.call_args[0][0]
        assert f"post_{post.id}" in mock_send_multi.call_args[0][0]

        # Post deleted
        mock_send_multi.reset_mock()
        broadcast_post_deleted(community.id, post.id)
        assert mock_send_multi.called
        assert mock_send_multi.call_args[0][1] == "post.deleted"

        # Post reaction
        mock_send_multi.reset_mock()
        broadcast_post_reaction(community.id, post.id, "like", 5, auth_user.id, "added")
        assert mock_send_multi.called
        assert mock_send_multi.call_args[0][1] == "post.reaction"

        # Comment created
        mock_send_single.reset_mock()
        broadcast_comment_created(comment)
        assert mock_send_single.called

        # Comment deleted
        mock_send_single.reset_mock()
        broadcast_comment_deleted(post.id, comment.id, community.id, 2)
        assert mock_send_single.called

        # Comment reaction
        mock_send_single.reset_mock()
        broadcast_comment_reaction(
            post.id, comment.id, "heart", 3, auth_user.id, "added"
        )
        assert mock_send_single.called
        assert mock_send_single.call_args[0][1] == "comment.reaction"


@pytest.mark.django_db(transaction=True)
def test_broadcast_notification_created(auth_user):
    from apps.notifications.models.notification import Notification

    notification = Notification.objects.create(
        recipient=auth_user,
        notification_type="system",
        title="Welcome",
        body="Welcome to Kodinga!",
    )
    with patch("realtime.broadcast.send_group_event") as mock_send_single:
        broadcast_notification_created(notification)
        assert mock_send_single.called
        assert mock_send_single.call_args[0][0] == f"user_{auth_user.id}"
        assert mock_send_single.call_args[0][1] == "notification.created"
