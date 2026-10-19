import json
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger("kodinga.realtime")


class MainMultiplexConsumer(AsyncJsonWebsocketConsumer):
    """
    Multiplexed WebSocket consumer for the Kodinga platform.
    Handles user channel subscriptions, community feeds, post threads, and heartbeat.
    """

    async def connect(self):
        user = self.scope.get("user")
        if not user or not getattr(user, "is_authenticated", False):
            logger.warning("[WS] Anonymous connection rejected.")
            await self.close(code=4401)
            return

        self.user = user
        self.user_group = f"user_{self.user.id}"
        self.subscribed_groups = set()

        # Join personal user group
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        self.subscribed_groups.add(self.user_group)

        await self.accept()
        logger.info(f"[WS CONNECTED] User {self.user.username} ({self.user.id}) connected.")

        # Send connection established hello
        await self.send_json({
            "v": 1,
            "type": "connection.established",
            "data": {
                "user_id": str(self.user.id),
                "username": self.user.username,
                "message": "Connected to Kodinga Realtime API.",
            },
        })

    async def disconnect(self, close_code):
        if hasattr(self, "subscribed_groups"):
            for group_name in list(self.subscribed_groups):
                await self.channel_layer.group_discard(group_name, self.channel_name)
        logger.info(f"[WS DISCONNECTED] Code: {close_code}")

    async def receive_json(self, content, **kwargs):
        """
        Handle incoming client commands (ping, subscribe, typing).
        """
        action = content.get("action") or content.get("type")

        if action == "ping":
            await self.send_json({"v": 1, "type": "pong", "ts": content.get("ts")})
            return

        # Additional actions will be handled here (subscribe_community, subscribe_post, typing, etc.)
        await self.send_json({
            "v": 1,
            "type": "ack",
            "action": action,
            "status": "received",
        })

    async def event_broadcast(self, event):
        """
        Generic handler for messages pushed from channel layers to this client.
        """
        payload = event.get("payload")
        if payload:
            await self.send_json(payload)
