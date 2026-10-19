import pytest
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model

from config.asgi import application

User = get_user_model()


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_websocket_anonymous_rejected():
    communicator = WebsocketCommunicator(application, "/ws/")
    connected, close_code = await communicator.connect()
    assert not connected
    assert close_code == 4401
    await communicator.disconnect()


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_websocket_authenticated_connect_and_ping():
    user = await User.objects.acreate(
        email="realtime_test_user@example.com",
        username="realtime_tester",
    )
    communicator = WebsocketCommunicator(application, "/ws/")
    communicator.scope["user"] = user
    connected, _ = await communicator.connect()
    assert connected

    # Read initial connection.established hello
    hello = await communicator.receive_json_from()
    assert hello["type"] == "connection.established"
    assert hello["data"]["user_id"] == str(user.id)
    assert hello["data"]["username"] == "realtime_tester"

    # Ping / Pong check
    await communicator.send_json_to({"action": "ping", "ts": 123456789})
    pong = await communicator.receive_json_from()
    assert pong["type"] == "pong"
    assert pong["ts"] == 123456789

    await communicator.disconnect()
