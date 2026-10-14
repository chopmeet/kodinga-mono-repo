import base64
import hashlib
import json
import logging
import time
from typing import Any, Optional

import jwt
from django.conf import settings

from apps.accounts.models.user import User

logger = logging.getLogger("kodinga.events")


class LiveKitService:
    """
    Handles LiveKit room access token generation and real-time room credentials.
    Standard LiveKit JWT access tokens with video/audio permissions grant.
    """

    @classmethod
    def get_server_url(cls) -> str:
        return getattr(settings, "LIVEKIT_URL", "wss://live.kodinga.com")

    @classmethod
    def _get_api_key(cls) -> str:
        return getattr(settings, "LIVEKIT_API_KEY", "devkey")

    @classmethod
    def _get_api_secret(cls) -> str:
        return getattr(
            settings, "LIVEKIT_API_SECRET", "secret_kodinga_livekit_2026_super_key"
        )

    @classmethod
    def generate_token(
        cls,
        user: User,
        room_name: str,
        is_host: bool = False,
        ttl_seconds: int = 14400,  # 4 hours
        metadata: Optional[dict[str, Any]] = None,
    ) -> str:
        """
        Generates a signed LiveKit access token with video grant permissions.
        - Host/Speaker: canPublish=True, canSubscribe=True, roomAdmin=True
        - Attendee/Viewer: canPublish=False, canSubscribe=True, canPublishData=True
        """
        api_key = cls._get_api_key()
        api_secret = cls._get_api_secret()
        now = int(time.time())

        user_name = user.get_full_name() or user.username
        avatar_url = getattr(getattr(user, "profile", None), "avatar_url", "")

        meta = {
            "username": user.username,
            "name": user_name,
            "avatar_url": avatar_url,
            "is_host": is_host,
            **(metadata or {}),
        }

        video_grant = {
            "room": room_name,
            "roomJoin": True,
            "canPublish": is_host,
            "canSubscribe": True,
            "canPublishData": True,
            "roomAdmin": is_host,
        }

        payload = {
            "iss": api_key,
            "sub": f"user_{user.id}",
            "name": user_name,
            "nbf": now - 5,
            "exp": now + ttl_seconds,
            "video": video_grant,
            "metadata": json.dumps(meta),
        }

        token = jwt.encode(payload, api_secret, algorithm="HS256")
        return token

    @classmethod
    def verify_webhook(cls, auth_header: str, body_bytes: bytes) -> bool:
        """
        Verifies that a webhook request originated from LiveKit server.
        LiveKit signs the request with a JWT in Authorization header containing
        the sha256 checksum of the body.
        """
        if not auth_header:
            return False

        token = auth_header.replace("Bearer ", "").strip()
        api_secret = cls._get_api_secret()

        try:
            claims = jwt.decode(token, api_secret, algorithms=["HS256"])
            expected_hash = claims.get("sha256")
            if expected_hash:
                computed_hash = base64.b64encode(
                    hashlib.sha256(body_bytes).digest()
                ).decode("utf-8")
                return expected_hash == computed_hash
            return True
        except Exception as exc:
            logger.warning(f"LiveKit webhook signature verification failed: {exc}")
            return False
