from datetime import timedelta
from unittest.mock import patch

import pytest
from django.db import transaction
from django.utils import timezone

from apps.accounts.models.user import User
from apps.communities.models.community import Community, CommunityCategory
from apps.posts.selectors.post_selector import PostSelector
from apps.posts.services.post_service import PostService


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
def community(db, auth_user):
    cat = CommunityCategory.objects.create(name="Design", slug="design")
    return Community.objects.create(
        name="Designers Hub",
        slug="designers-hub",
        owner=auth_user,
        category=cat,
    )


@pytest.mark.django_db(transaction=True)
def test_post_lifecycle_broadcasts(auth_user, community):
    with patch("realtime.broadcast.send_group_event") as mock_send_single:
        # 1. Create Post
        with transaction.atomic():
            post = PostService.create_post(
                author=auth_user,
                community=community,
                data={"title": "UI Trends 2026", "content": "Minimalism is back!"},
            )

        assert mock_send_single.called
        assert mock_send_single.call_args[0][0] == f"community_{community.id}"
        assert mock_send_single.call_args[0][1] == "post.created"
        assert mock_send_single.call_args[0][2]["title"] == "UI Trends 2026"

    with patch("realtime.broadcast.send_groups_event") as mock_send_multi:
        # 2. Update Post
        with transaction.atomic():
            PostService.update_post(
                user=auth_user,
                post=post,
                data={"title": "UI Trends 2026 (Updated)"},
            )

        assert mock_send_multi.called
        groups = mock_send_multi.call_args[0][0]
        assert f"community_{community.id}" in groups
        assert f"post_{post.id}" in groups
        assert mock_send_multi.call_args[0][1] == "post.updated"

    with patch("realtime.broadcast.send_group_event") as mock_send_single:
        # 3. Pin Post
        with transaction.atomic():
            is_pinned = PostService.toggle_post_pin(auth_user, post)

        assert is_pinned is True
        assert mock_send_single.called
        assert mock_send_single.call_args[0][0] == f"community_{community.id}"
        assert mock_send_single.call_args[0][1] == "post.pinned"

    with patch("realtime.broadcast.send_groups_event") as mock_send_multi:
        # 4. Lock Post
        with transaction.atomic():
            is_locked = PostService.toggle_post_lock(auth_user, post)

        assert is_locked is True
        assert mock_send_multi.called
        assert mock_send_multi.call_args[0][1] == "post.locked"

        # 5. Reaction
        mock_send_multi.reset_mock()
        with transaction.atomic():
            has_reacted = PostService.toggle_post_reaction(auth_user, post, "like")

        assert has_reacted is True
        assert mock_send_multi.called
        assert mock_send_multi.call_args[0][1] == "post.reaction"
        assert mock_send_multi.call_args[0][2]["action"] == "added"

        # 6. Delete Post
        mock_send_multi.reset_mock()
        with transaction.atomic():
            PostService.delete_post(auth_user, post)

        assert mock_send_multi.called
        assert mock_send_multi.call_args[0][1] == "post.deleted"


@pytest.mark.django_db(transaction=True)
def test_comment_lifecycle_broadcasts(auth_user, community):
    post = PostService.create_post(
        author=auth_user,
        community=community,
        data={"title": "Questions on Architecture", "content": "How to scale?"},
    )

    with patch("realtime.broadcast.send_group_event") as mock_send_single:
        # 1. Create Comment
        with transaction.atomic():
            comment = PostService.create_comment(
                author=auth_user,
                post=post,
                content="Use Redis and Daphne for WebSockets!",
            )

        assert mock_send_single.called
        calls = [c[0] for c in mock_send_single.call_args_list]
        post_calls = [c for c in calls if c[0] == f"post_{post.id}"]
        assert len(post_calls) >= 1
        assert post_calls[0][1] == "comment.created"

        # 2. Accepted Answer
        mock_send_single.reset_mock()
        with transaction.atomic():
            PostService.mark_accepted_answer(auth_user, comment)

        assert mock_send_single.called
        assert mock_send_single.call_args[0][0] == f"post_{post.id}"
        assert mock_send_single.call_args[0][1] == "comment.accepted"

        # 3. Comment Reaction
        mock_send_single.reset_mock()
        with transaction.atomic():
            has_reacted = PostService.toggle_comment_reaction(
                auth_user, comment, "like"
            )

        assert has_reacted is True
        assert mock_send_single.called
        assert mock_send_single.call_args[0][0] == f"post_{post.id}"
        assert mock_send_single.call_args[0][1] == "comment.reaction"

        # 4. Delete Comment
        mock_send_single.reset_mock()
        with transaction.atomic():
            PostService.delete_comment(auth_user, comment)

        assert mock_send_single.called
        del_calls = [
            c[0]
            for c in mock_send_single.call_args_list
            if c[0][1] == "comment.deleted"
        ]
        assert len(del_calls) >= 1


@pytest.mark.django_db(transaction=True)
def test_catch_up_since_filtering(auth_user, community):
    now = timezone.now()
    p1 = PostService.create_post(
        author=auth_user,
        community=community,
        data={"title": "Older Post", "content": "Old"},
    )
    # Manually backdate p1 updated_at
    old_time = now - timedelta(hours=2)
    type(p1).objects.filter(id=p1.id).update(updated_at=old_time)

    p2 = PostService.create_post(
        author=auth_user,
        community=community,
        data={"title": "Newer Post", "content": "New"},
    )

    # 1. Without since: both posts returned
    all_posts = list(PostSelector.get_community_feed(community=community))
    assert len(all_posts) == 2

    # 2. With since: only newer post returned
    since_time = now - timedelta(hours=1)
    new_posts = list(
        PostSelector.get_community_feed(community=community, since=since_time)
    )
    assert len(new_posts) == 1
    assert new_posts[0].id == p2.id
