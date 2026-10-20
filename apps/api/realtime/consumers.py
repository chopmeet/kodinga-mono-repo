import logging
import time

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger("kodinga.realtime")


@database_sync_to_async
def check_can_subscribe_community(user, community_id: str):
    from apps.communities.models.community import (
        Community,
        CommunityPricing,
        CommunityPrivacy,
    )
    from apps.memberships.permissions import is_active_community_member
    from common.permissions.base import is_superadmin_user

    community = Community.objects.filter(id=community_id).first()
    if not community:
        return False, "Communauté introuvable."

    if is_superadmin_user(user) or community.owner_id == user.id:
        return True, None

    is_public = (
        community.privacy_type == CommunityPrivacy.PUBLIC
        and getattr(community, "pricing_type", None) == CommunityPricing.FREE
    )
    if is_public or is_active_community_member(user, community):
        return True, None

    return False, "Vous devez être membre actif pour accéder à cet espace."


@database_sync_to_async
def check_can_subscribe_post(user, post_id: str):
    from apps.communities.models.community import (
        CommunityPricing,
        CommunityPrivacy,
    )
    from apps.memberships.permissions import is_active_community_member
    from apps.posts.models.post import Post
    from common.permissions.base import is_superadmin_user

    post = Post.objects.select_related("community").filter(id=post_id).first()
    if not post:
        return False, "Publication introuvable."

    community = post.community
    if is_superadmin_user(user) or community.owner_id == user.id:
        return True, None

    is_public = (
        community.privacy_type == CommunityPrivacy.PUBLIC
        and getattr(community, "pricing_type", None) == CommunityPricing.FREE
    )
    if is_public or is_active_community_member(user, community):
        return True, None

    return False, "Accès refusé au fil de commentaires de cette publication."


@database_sync_to_async
def check_can_access_conversation(user, conversation_id: str):
    from apps.messaging.models.conversation import Conversation
    from common.permissions.base import is_superadmin_user

    if is_superadmin_user(user):
        return True, None

    conversation = Conversation.objects.filter(id=conversation_id).first()
    if not conversation:
        return False, "Conversation introuvable."

    is_participant = conversation.participants.filter(user=user).exists()
    if is_participant:
        return True, None

    return False, "Vous ne faites pas partie de cette conversation."


class MainMultiplexConsumer(AsyncJsonWebsocketConsumer):
    """
    Multiplexed WebSocket consumer for the Kodinga platform.
    Handles personal user channel, community feeds, post comments, typing indicators, and heartbeat.
    """

    async def connect(self):
        user = self.scope.get("user")
        if not user or not getattr(user, "is_authenticated", False):
            logger.warning("[WS] Anonymous connection rejected.")
            await self.close(code=4401)
            return

        if not getattr(user, "is_active", True):
            logger.warning(f"[WS] Disabled user {user.username} rejected.")
            await self.close(code=4403)
            return

        self.user = user
        self.user_group = f"user_{self.user.id}"
        self.subscribed_groups = set()
        self.last_typing_timestamps = {}

        # 1. Join personal user group
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        self.subscribed_groups.add(self.user_group)

        await self.accept()
        logger.info(
            f"[WS CONNECTED] User {self.user.username} ({self.user.id}) connected."
        )

        # 2. Send initial connection confirmation
        await self.send_json(
            {
                "v": 1,
                "type": "connection.established",
                "data": {
                    "user_id": str(self.user.id),
                    "username": self.user.username,
                    "message": "Connected to Kodinga Realtime API.",
                },
            }
        )

    async def disconnect(self, close_code):
        if hasattr(self, "subscribed_groups"):
            for group_name in list(self.subscribed_groups):
                await self.channel_layer.group_discard(
                    group_name, self.channel_name
                )
            self.subscribed_groups.clear()
        logger.info(
            f"[WS DISCONNECTED] User {getattr(self, 'user', None)} with code: {close_code}"
        )

    async def receive_json(self, content, **kwargs):
        """
        Dispatch incoming client actions.
        """
        action = content.get("action") or content.get("type")

        # 1. Heartbeat Ping / Pong
        if action == "ping":
            await self.send_json(
                {"v": 1, "type": "pong", "ts": content.get("ts")}
            )
            return

        # 2. Subscribe Community Feed
        if action == "subscribe_community":
            community_id = content.get("community_id")
            if not community_id:
                await self.send_error(
                    "community_id obligatoire pour l'abonnement."
                )
                return

            allowed, error_msg = await check_can_subscribe_community(
                self.user, community_id
            )
            if not allowed:
                await self.send_error(
                    error_msg or "Accès refusé.", code="permission_denied"
                )
                return

            group_name = f"community_{community_id}"
            await self.channel_layer.group_add(group_name, self.channel_name)
            self.subscribed_groups.add(group_name)
            await self.send_json(
                {
                    "v": 1,
                    "type": "subscribed",
                    "target": "community",
                    "id": str(community_id),
                }
            )
            return

        # 3. Unsubscribe Community Feed
        if action == "unsubscribe_community":
            community_id = content.get("community_id")
            group_name = f"community_{community_id}"
            if group_name in self.subscribed_groups:
                await self.channel_layer.group_discard(
                    group_name, self.channel_name
                )
                self.subscribed_groups.discard(group_name)
            await self.send_json(
                {
                    "v": 1,
                    "type": "unsubscribed",
                    "target": "community",
                    "id": str(community_id),
                }
            )
            return

        # 4. Subscribe Post Thread (Comments)
        if action == "subscribe_post":
            post_id = content.get("post_id")
            if not post_id:
                await self.send_error("post_id obligatoire pour l'abonnement.")
                return

            allowed, error_msg = await check_can_subscribe_post(
                self.user, post_id
            )
            if not allowed:
                await self.send_error(
                    error_msg or "Accès refusé.", code="permission_denied"
                )
                return

            group_name = f"post_{post_id}"
            await self.channel_layer.group_add(group_name, self.channel_name)
            self.subscribed_groups.add(group_name)
            await self.send_json(
                {
                    "v": 1,
                    "type": "subscribed",
                    "target": "post",
                    "id": str(post_id),
                }
            )
            return

        # 5. Unsubscribe Post Thread
        if action == "unsubscribe_post":
            post_id = content.get("post_id")
            group_name = f"post_{post_id}"
            if group_name in self.subscribed_groups:
                await self.channel_layer.group_discard(
                    group_name, self.channel_name
                )
                self.subscribed_groups.discard(group_name)
            await self.send_json(
                {
                    "v": 1,
                    "type": "unsubscribed",
                    "target": "post",
                    "id": str(post_id),
                }
            )
            return

        # 6. Subscribe Conversation (Ephemeral Events)
        if action == "subscribe_conversation":
            conversation_id = content.get("conversation_id")
            if not conversation_id:
                await self.send_error(
                    "conversation_id obligatoire pour l'abonnement."
                )
                return

            allowed, error_msg = await check_can_access_conversation(
                self.user, conversation_id
            )
            if not allowed:
                await self.send_error(
                    error_msg or "Accès refusé.", code="permission_denied"
                )
                return

            group_name = f"conversation_{conversation_id}"
            await self.channel_layer.group_add(group_name, self.channel_name)
            self.subscribed_groups.add(group_name)
            await self.send_json(
                {
                    "v": 1,
                    "type": "subscribed",
                    "target": "conversation",
                    "id": str(conversation_id),
                }
            )
            return

        # 7. Unsubscribe Conversation
        if action == "unsubscribe_conversation":
            conversation_id = content.get("conversation_id")
            group_name = f"conversation_{conversation_id}"
            if group_name in self.subscribed_groups:
                await self.channel_layer.group_discard(
                    group_name, self.channel_name
                )
                self.subscribed_groups.discard(group_name)
            await self.send_json(
                {
                    "v": 1,
                    "type": "unsubscribed",
                    "target": "conversation",
                    "id": str(conversation_id),
                }
            )
            return

        # 8. Typing indicator (ephemeral)
        if action == "typing":
            conversation_id = content.get("conversation_id")
            is_typing = bool(content.get("is_typing", True))
            if not conversation_id:
                return

            # Rate limit typing signals (max 1 per second per conversation)
            now = time.time()
            last_ts = self.last_typing_timestamps.get(str(conversation_id), 0)
            if now - last_ts < 1.0:
                return
            self.last_typing_timestamps[str(conversation_id)] = now

            allowed, _ = await check_can_access_conversation(
                self.user, conversation_id
            )
            if not allowed:
                return

            group_name = f"conversation_{conversation_id}"
            event_type = "typing.started" if is_typing else "typing.stopped"
            await self.channel_layer.group_send(
                group_name,
                {
                    "type": "event_broadcast",
                    "sender_channel": self.channel_name,
                    "payload": {
                        "v": 1,
                        "type": event_type,
                        "data": {
                            "conversation_id": str(conversation_id),
                            "user": {
                                "id": str(self.user.id),
                                "username": self.user.username,
                            },
                        },
                    },
                },
            )
            return

        # Fallback unknown action ack
        await self.send_json(
            {
                "v": 1,
                "type": "ack",
                "action": action,
                "status": "received",
            }
        )

    async def event_broadcast(self, event):
        """
        Handler invoked when a group message is broadcasted via channel_layer.group_send.
        Excludes the sender channel for echo suppression when applicable.
        """
        sender_channel = event.get("sender_channel")
        if sender_channel and sender_channel == self.channel_name:
            return

        payload = event.get("payload")
        if payload:
            await self.send_json(payload)

    async def send_error(self, message: str, code: str = "bad_request"):
        await self.send_json(
            {
                "v": 1,
                "type": "error",
                "code": code,
                "message": message,
            }
        )
