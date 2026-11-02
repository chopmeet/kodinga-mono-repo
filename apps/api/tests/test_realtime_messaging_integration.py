from unittest.mock import patch

import pytest
from apps.accounts.models.user import User
from apps.communities.models.community import Community, CommunityCategory
from apps.messaging.services.messaging_service import MessagingService
from django.db import transaction


@pytest.fixture
def user_alice(db):
    return User.objects.create_user(
        username="alice",
        email="alice@example.com",
        password="password123",
    )


@pytest.fixture
def user_bob(db):
    return User.objects.create_user(
        username="bob",
        email="bob@example.com",
        password="password123",
    )


@pytest.fixture
def user_charlie(db):
    return User.objects.create_user(
        username="charlie",
        email="charlie@example.com",
        password="password123",
    )


@pytest.fixture
def community(db, user_alice):
    category = CommunityCategory.objects.create(name="Tech", slug="tech-comm")
    return Community.objects.create(
        name="Tech Community",
        slug="tech-comm",
        owner=user_alice,
        category=category,
    )


@pytest.mark.django_db(transaction=True)
def test_direct_conversation_broadcasts(user_alice, user_bob):
    with patch("realtime.broadcast.send_groups_event") as mock_send_multi:
        with transaction.atomic():
            conv, created = MessagingService.start_direct_conversation(
                user_alice, user_bob
            )

        assert created is True
        assert mock_send_multi.called
        call_args = mock_send_multi.call_args[0]
        assert f"user_{user_alice.id}" in call_args[0]
        assert f"user_{user_bob.id}" in call_args[0]
        assert call_args[1] == "conversation.created"


@pytest.mark.django_db(transaction=True)
def test_group_conversation_broadcasts(user_alice, user_bob, user_charlie):
    with patch("realtime.broadcast.send_groups_event") as mock_send_multi:
        with transaction.atomic():
            conv = MessagingService.create_group_conversation(
                creator=user_alice,
                title="Super Dev Group",
                participants_users=[user_bob, user_charlie],
            )

        assert conv is not None
        assert mock_send_multi.called
        call_args = mock_send_multi.call_args[0]
        assert f"user_{user_alice.id}" in call_args[0]
        assert f"user_{user_bob.id}" in call_args[0]
        assert f"user_{user_charlie.id}" in call_args[0]
        assert call_args[1] == "conversation.created"


@pytest.mark.django_db(transaction=True)
def test_send_message_broadcasts(user_alice, user_bob):
    conv, _ = MessagingService.start_direct_conversation(user_alice, user_bob)

    with (
        patch("realtime.broadcast.send_group_event") as mock_send_single,
        patch("realtime.broadcast.send_groups_event") as mock_send_multi,
    ):
        with transaction.atomic():
            msg = MessagingService.send_message(
                conversation=conv,
                sender=user_alice,
                content="Hello Bob via Realtime!",
            )

        assert msg is not None

        # 1. Message created sent to conversation group
        assert mock_send_single.called
        single_calls = [c[0] for c in mock_send_single.call_args_list]
        conv_call = [c for c in single_calls if c[0] == f"conversation_{conv.id}"]
        assert len(conv_call) >= 1
        assert conv_call[0][1] == "message.created"
        assert conv_call[0][2]["content"] == "Hello Bob via Realtime!"

        # 2. Preview sent to participant user groups
        assert mock_send_multi.called
        multi_calls = [c[0] for c in mock_send_multi.call_args_list]
        preview_call = [
            c for c in multi_calls if c[1] == "conversation.message_preview"
        ]
        assert len(preview_call) >= 1
        assert f"user_{user_bob.id}" in preview_call[0][0]


@pytest.mark.django_db(transaction=True)
def test_mark_as_read_broadcasts(user_alice, user_bob):
    conv, _ = MessagingService.start_direct_conversation(user_alice, user_bob)
    MessagingService.send_message(conv, user_alice, "Hello")

    with patch("realtime.broadcast.send_group_event") as mock_send_single:
        with transaction.atomic():
            success = MessagingService.mark_as_read(conv, user_bob)

        assert success is True
        assert mock_send_single.called
        call_args = mock_send_single.call_args[0]
        assert call_args[0] == f"conversation_{conv.id}"
        assert call_args[1] == "message.read"
        assert call_args[2]["user_id"] == str(user_bob.id)


@pytest.mark.django_db(transaction=True)
def test_edit_delete_and_pin_message_broadcasts(user_alice, user_bob):
    conv, _ = MessagingService.start_direct_conversation(user_alice, user_bob)
    msg = MessagingService.send_message(conv, user_alice, "Initial content")

    with patch("realtime.broadcast.send_group_event") as mock_send_single:
        # Edit
        with transaction.atomic():
            MessagingService.edit_message(msg, user_alice, "Updated content")

        assert mock_send_single.called
        assert mock_send_single.call_args[0][0] == f"conversation_{conv.id}"
        assert mock_send_single.call_args[0][1] == "message.updated"

        # Pin
        mock_send_single.reset_mock()
        with transaction.atomic():
            is_pinned = MessagingService.toggle_message_pin(msg, user_alice)

        assert is_pinned is True
        assert mock_send_single.called
        assert mock_send_single.call_args[0][1] == "message.pinned"
        assert mock_send_single.call_args[0][2]["is_pinned"] is True

        # Delete
        mock_send_single.reset_mock()
        with transaction.atomic():
            MessagingService.delete_message(msg, user_alice)

        assert mock_send_single.called
        assert mock_send_single.call_args[0][1] == "message.deleted"
