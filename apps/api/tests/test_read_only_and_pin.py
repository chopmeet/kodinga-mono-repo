import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.communities.models.category import CommunityCategory
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.communities.models.settings import CommunitySettings
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.messaging.models.conversation import Conversation, ConversationType
from apps.messaging.models.participant import ConversationParticipant, ParticipantRole


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_owner(db):
    return User.objects.create_user(
        email="owner@kodinga.com",
        username="ownerdev",
        password="SecurePassword123!",
        first_name="Ada",
        last_name="Lovelace",
    )


@pytest.fixture
def user_member(db):
    return User.objects.create_user(
        email="member@kodinga.com",
        username="memberdev",
        password="SecurePassword123!",
        first_name="Alan",
        last_name="Turing",
    )


@pytest.fixture
def community(db, user_owner, user_member):
    cat = CommunityCategory.objects.create(name="Python", slug="python")
    comm = Community.objects.create(
        name="Python Community",
        slug="python-community",
        owner=user_owner,
        category=cat,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.FREE,
    )
    CommunitySettings.objects.create(community=comm, is_read_only=False)
    CommunityMember.objects.create(
        community=comm,
        user=user_owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=user_member,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.mark.django_db
class TestCommunityReadOnlyAndPin:
    def test_owner_can_toggle_community_read_only_setting(
        self, api_client, user_owner, user_member, community
    ):
        url = f"/api/v1/communities/{community.slug}/settings/"

        # Member tries to change settings -> 403 Forbidden
        api_client.force_authenticate(user=user_member)
        res_fail = api_client.patch(url, {"is_read_only": True}, format="json")
        assert res_fail.status_code == status.HTTP_403_FORBIDDEN

        # Owner can enable read-only
        api_client.force_authenticate(user=user_owner)
        res_ok = api_client.patch(url, {"is_read_only": True}, format="json")
        assert res_ok.status_code == status.HTTP_200_OK
        data = res_ok.data.get("data") or res_ok.data
        assert data["is_read_only"] is True

        community.settings.refresh_from_db()
        assert community.settings.is_read_only is True

    def test_read_only_community_blocks_member_posts_and_comments_but_allows_reading(
        self, api_client, user_owner, user_member, community
    ):
        feed_url = f"/api/v1/communities/{community.slug}/feed/"

        # 1. Enable read-only mode on community
        community.settings.is_read_only = True
        community.settings.save()

        # 2. Member tries to create a post -> 403 Forbidden
        api_client.force_authenticate(user=user_member)
        post_fail = api_client.post(
            feed_url,
            {"title": "Question membre", "content": "Je pose une question"},
            format="json",
        )
        assert post_fail.status_code == status.HTTP_403_FORBIDDEN
        assert "lecture seule" in str(post_fail.data)

        # 3. Owner can still post
        api_client.force_authenticate(user=user_owner)
        post_ok = api_client.post(
            feed_url,
            {"title": "Annonce Importante", "content": "Bienvenue à tous !"},
            format="json",
        )
        assert post_ok.status_code == status.HTTP_201_CREATED
        post_data = post_ok.data.get("data") or post_ok.data
        post_id = post_data["id"]

        # 4. Member CAN read the feed and the post
        api_client.force_authenticate(user=user_member)
        feed_get = api_client.get(feed_url)
        assert feed_get.status_code == status.HTTP_200_OK
        feed_results = (
            feed_get.data.get("results")
            if "results" in feed_get.data
            else feed_get.data
        )
        assert len(feed_results) == 1
        assert feed_results[0]["title"] == "Annonce Importante"

        # 5. Member tries to comment on the post -> 403 Forbidden
        comment_url = f"/api/v1/posts/{post_id}/comments/"
        comment_fail = api_client.post(
            comment_url, {"content": "Mon commentaire"}, format="json"
        )
        assert comment_fail.status_code == status.HTTP_403_FORBIDDEN
        assert "lecture seule" in str(comment_fail.data)

        # 6. Owner CAN comment
        api_client.force_authenticate(user=user_owner)
        comment_ok = api_client.post(
            comment_url, {"content": "Note additionnelle du créateur"}, format="json"
        )
        assert comment_ok.status_code == status.HTTP_201_CREATED

        # 7. Member CAN read comments
        api_client.force_authenticate(user=user_member)
        comments_get = api_client.get(comment_url)
        assert comments_get.status_code == status.HTTP_200_OK
        comments_data = comments_get.data.get("data") or comments_get.data
        assert len(comments_data) == 1

    def test_owner_can_pin_post_to_top_of_discussion_feed(
        self, api_client, user_owner, user_member, community
    ):
        feed_url = f"/api/v1/communities/{community.slug}/feed/"
        api_client.force_authenticate(user=user_owner)

        # Create post 1 (older)
        p1_res = api_client.post(
            feed_url,
            {"title": "Discussion 1", "content": "Contenu du premier post"},
            format="json",
        )
        p1_id = (p1_res.data.get("data") or p1_res.data)["id"]

        # Create post 2 (newer)
        p2_res = api_client.post(
            feed_url,
            {"title": "Discussion 2", "content": "Contenu du deuxième post"},
            format="json",
        )
        p2_id = (p2_res.data.get("data") or p2_res.data)["id"]

        # Initially Discussion 2 is top because it is newer
        feed_before = api_client.get(feed_url)
        results = (
            feed_before.data.get("results")
            if "results" in feed_before.data
            else feed_before.data
        )
        assert results[0]["id"] == p2_id

        # Member tries to pin Discussion 1 -> 403 Forbidden
        api_client.force_authenticate(user=user_member)
        pin_fail = api_client.post(f"/api/v1/posts/{p1_id}/pin/", format="json")
        assert pin_fail.status_code == status.HTTP_403_FORBIDDEN

        # Owner pins Discussion 1 to the top
        api_client.force_authenticate(user=user_owner)
        pin_ok = api_client.post(f"/api/v1/posts/{p1_id}/pin/", format="json")
        assert pin_ok.status_code == status.HTTP_200_OK
        assert (pin_ok.data.get("data") or pin_ok.data)["is_pinned"] is True

        # Now Discussion 1 is pinned and appears at the top!
        feed_after = api_client.get(feed_url)
        results_after = (
            feed_after.data.get("results")
            if "results" in feed_after.data
            else feed_after.data
        )
        assert results_after[0]["id"] == p1_id
        assert results_after[0]["is_pinned"] is True

    def test_read_only_and_pin_in_messaging_conversation(
        self, api_client, user_owner, user_member, community
    ):
        # Create group conversation attached to the community
        conv = Conversation.objects.create(
            conversation_type=ConversationType.GROUP,
            title="Chat Communauté",
            created_by=user_owner,
            community=community,
        )
        ConversationParticipant.objects.create(
            conversation=conv, user=user_owner, role=ParticipantRole.ADMIN
        )
        ConversationParticipant.objects.create(
            conversation=conv, user=user_member, role=ParticipantRole.MEMBER
        )

        # 1. When community is read-only, member cannot send message
        community.settings.is_read_only = True
        community.settings.save()

        api_client.force_authenticate(user=user_member)
        msg_fail = api_client.post(
            f"/api/v1/conversations/{conv.id}/messages/",
            {"content": "Bonjour !"},
            format="json",
        )
        assert msg_fail.status_code == status.HTTP_403_FORBIDDEN

        # 2. Owner can send message
        api_client.force_authenticate(user=user_owner)
        msg_ok = api_client.post(
            f"/api/v1/conversations/{conv.id}/messages/",
            {"content": "Consignes de la semaine"},
            format="json",
        )
        assert msg_ok.status_code == status.HTTP_201_CREATED
        msg_data = msg_ok.data.get("data") or msg_ok.data
        msg_id = msg_data["id"]

        # 3. Member tries to pin message -> 403 Forbidden
        api_client.force_authenticate(user=user_member)
        pin_fail = api_client.post(f"/api/v1/messages/{msg_id}/pin/", format="json")
        assert pin_fail.status_code == status.HTTP_403_FORBIDDEN

        # 4. Owner pins message -> 200 OK
        api_client.force_authenticate(user=user_owner)
        pin_ok = api_client.post(f"/api/v1/messages/{msg_id}/pin/", format="json")
        assert pin_ok.status_code == status.HTTP_200_OK
        data = pin_ok.data.get("data") or pin_ok.data
        assert data["is_pinned"] is True

        # 5. Member can read messages
        api_client.force_authenticate(user=user_member)
        msgs_res = api_client.get(f"/api/v1/conversations/{conv.id}/messages/")
        assert msgs_res.status_code == status.HTTP_200_OK
        msgs = (
            msgs_res.data
            if isinstance(msgs_res.data, list)
            else (msgs_res.data.get("data") or msgs_res.data)
        )
        assert len(msgs) == 1
        assert msgs[0]["is_pinned"] is True
