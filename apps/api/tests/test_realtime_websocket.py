import pytest
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.messaging.models.conversation import Conversation, ConversationType
from apps.messaging.models.participant import ConversationParticipant
from apps.posts.models.post import Post, PostType
from config.asgi import application
from realtime.auth import RealtimeAuthService

User = get_user_model()


@pytest.fixture
def auth_user(db):
    return User.objects.create_user(
        email="realtime_alice@example.com",
        username="alice",
        password="TestPassword123!",
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        email="realtime_bob@example.com",
        username="bob",
        password="TestPassword123!",
    )


@pytest.fixture
def public_community(db, auth_user):
    return Community.objects.create(
        name="Python Dakar",
        slug="python-dakar",
        owner=auth_user,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.FREE,
    )


@pytest.fixture
def private_community(db, other_user):
    return Community.objects.create(
        name="Private AI Lab",
        slug="private-ai-lab",
        owner=other_user,
        privacy_type=CommunityPrivacy.PRIVATE,
        pricing_type=CommunityPricing.PAID,
    )


@pytest.mark.django_db(transaction=True)
def test_rest_ws_ticket_generation(auth_user):
    client = APIClient()

    # Anonymous call fails
    resp = client.post("/api/v1/auth/ws-ticket/")
    assert resp.status_code == 401

    # Authenticated call succeeds
    client.force_authenticate(user=auth_user)
    resp = client.post("/api/v1/auth/ws-ticket/")
    assert resp.status_code == 200
    data = resp.json()
    assert "ticket" in data
    assert data["expires_in"] == 30


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_websocket_ticket_auth_success_and_single_use(auth_user):
    # 1. Create ticket
    ticket_data = RealtimeAuthService.create_ticket(auth_user)
    ticket = ticket_data["ticket"]

    # 2. Connect with ticket
    communicator = WebsocketCommunicator(application, f"/ws/?ticket={ticket}")
    connected, _ = await communicator.connect()
    assert connected

    hello = await communicator.receive_json_from()
    assert hello["type"] == "connection.established"
    assert hello["data"]["user_id"] == str(auth_user.id)
    await communicator.disconnect()

    # 3. Second connection with same ticket fails (single use)
    communicator2 = WebsocketCommunicator(application, f"/ws/?ticket={ticket}")
    connected2, close_code2 = await communicator2.connect()
    assert not connected2
    assert close_code2 == 4401
    await communicator2.disconnect()


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_websocket_invalid_or_missing_ticket_rejected():
    # No ticket
    c1 = WebsocketCommunicator(application, "/ws/")
    conn1, code1 = await c1.connect()
    assert not conn1
    assert code1 == 4401
    await c1.disconnect()

    # Invalid ticket
    c2 = WebsocketCommunicator(application, "/ws/?ticket=fake_invalid_ticket")
    conn2, code2 = await c2.connect()
    assert not conn2
    assert code2 == 4401
    await c2.disconnect()


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_websocket_inactive_user_rejected(auth_user):
    auth_user.is_active = False
    await auth_user.asave()

    ticket_data = RealtimeAuthService.create_ticket(auth_user)
    c = WebsocketCommunicator(application, f"/ws/?ticket={ticket_data['ticket']}")
    conn, code = await c.connect()
    assert not conn
    assert code == 4401
    await c.disconnect()


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_websocket_community_subscriptions(
    auth_user, public_community, private_community
):
    ticket_data = RealtimeAuthService.create_ticket(auth_user)
    c = WebsocketCommunicator(application, f"/ws/?ticket={ticket_data['ticket']}")
    connected, _ = await c.connect()
    assert connected
    await c.receive_json_from()  # Hello

    # 1. Subscribe to public community -> success
    await c.send_json_to(
        {
            "action": "subscribe_community",
            "community_id": str(public_community.id),
        }
    )
    resp = await c.receive_json_from()
    assert resp["type"] == "subscribed"
    assert resp["target"] == "community"
    assert resp["id"] == str(public_community.id)

    # 2. Subscribe to private community (not a member) -> permission denied error
    await c.send_json_to(
        {
            "action": "subscribe_community",
            "community_id": str(private_community.id),
        }
    )
    err = await c.receive_json_from()
    assert err["type"] == "error"
    assert err["code"] == "permission_denied"

    # 3. Add active membership and retry
    await CommunityMember.objects.acreate(
        community=private_community,
        user=auth_user,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    await c.send_json_to(
        {
            "action": "subscribe_community",
            "community_id": str(private_community.id),
        }
    )
    resp2 = await c.receive_json_from()
    assert resp2["type"] == "subscribed"
    assert resp2["id"] == str(private_community.id)

    # 4. Unsubscribe
    await c.send_json_to(
        {
            "action": "unsubscribe_community",
            "community_id": str(private_community.id),
        }
    )
    unsub = await c.receive_json_from()
    assert unsub["type"] == "unsubscribed"

    await c.disconnect()


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_websocket_post_thread_subscriptions(auth_user, public_community):
    post = await Post.objects.acreate(
        community=public_community,
        author=auth_user,
        title="Async Python Post",
        content="Testing websocket threads",
        post_type=PostType.DISCUSSION,
    )

    ticket_data = RealtimeAuthService.create_ticket(auth_user)
    c = WebsocketCommunicator(application, f"/ws/?ticket={ticket_data['ticket']}")
    connected, _ = await c.connect()
    assert connected
    await c.receive_json_from()

    # Subscribe to post thread
    await c.send_json_to(
        {
            "action": "subscribe_post",
            "post_id": str(post.id),
        }
    )
    sub_resp = await c.receive_json_from()
    assert sub_resp["type"] == "subscribed"
    assert sub_resp["target"] == "post"
    assert sub_resp["id"] == str(post.id)

    # Unsubscribe from post thread
    await c.send_json_to(
        {
            "action": "unsubscribe_post",
            "post_id": str(post.id),
        }
    )
    unsub_resp = await c.receive_json_from()
    assert unsub_resp["type"] == "unsubscribed"

    await c.disconnect()


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_websocket_typing_indicator(auth_user, other_user):
    conv = await Conversation.objects.acreate(
        conversation_type=ConversationType.DIRECT,
        created_by=auth_user,
    )
    await ConversationParticipant.objects.acreate(conversation=conv, user=auth_user)
    await ConversationParticipant.objects.acreate(conversation=conv, user=other_user)

    # Alice connects
    t_alice = RealtimeAuthService.create_ticket(auth_user)
    c_alice = WebsocketCommunicator(application, f"/ws/?ticket={t_alice['ticket']}")
    await c_alice.connect()
    await c_alice.receive_json_from()
    await c_alice.send_json_to(
        {
            "action": "subscribe_conversation",
            "conversation_id": str(conv.id),
        }
    )
    await c_alice.receive_json_from()

    # Bob connects
    t_bob = RealtimeAuthService.create_ticket(other_user)
    c_bob = WebsocketCommunicator(application, f"/ws/?ticket={t_bob['ticket']}")
    await c_bob.connect()
    await c_bob.receive_json_from()
    await c_bob.send_json_to(
        {
            "action": "subscribe_conversation",
            "conversation_id": str(conv.id),
        }
    )
    await c_bob.receive_json_from()

    # Alice sends typing started
    await c_alice.send_json_to(
        {
            "action": "typing",
            "conversation_id": str(conv.id),
            "is_typing": True,
        }
    )

    # Bob receives typing.started
    bob_msg = await c_bob.receive_json_from()
    assert bob_msg["type"] == "typing.started"
    assert bob_msg["data"]["conversation_id"] == str(conv.id)
    assert bob_msg["data"]["user"]["username"] == "alice"

    # Alice does NOT receive her own typing message (echo suppression)
    assert await c_alice.receive_nothing()

    await c_alice.disconnect()
    await c_bob.disconnect()
