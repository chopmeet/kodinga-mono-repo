import hashlib
import hmac
import json
import logging
import time
import uuid
from typing import Any, Optional

import requests
from django.conf import settings
from rest_framework.exceptions import NotFound, ValidationError

from apps.accounts.models.user import User
from apps.media.models.video_asset import VideoAsset, VideoStatus
from common.permissions.base import is_superadmin_user

logger = logging.getLogger('kodinga.media')


class MuxVideoService:
    """
    Manages Mux Video Direct Uploads, Webhook Processing, and Playback Asset Tracking.
    """

    MUX_API_URL = "https://api.mux.com/video/v1"

    @classmethod
    def _get_auth(cls) -> Optional[tuple]:
        token_id = getattr(settings, 'MUX_TOKEN_ID', '')
        token_secret = getattr(settings, 'MUX_TOKEN_SECRET', '')
        if token_id and token_secret:
            return (token_id, token_secret)
        return None

    @classmethod
    def create_direct_upload(
        cls,
        user: User,
        title: str = "",
        description: str = "",
        passthrough: str = "",
        cors_origin: str = "*",
    ) -> dict[str, Any]:
        """
        Creates a direct upload URL via Mux REST API and registers a waiting VideoAsset.
        """
        passthrough_val = passthrough or f"user_{user.id}_{uuid.uuid4().hex[:8]}"
        auth = cls._get_auth()

        upload_id = None
        upload_url = None

        if auth:
            payload = {
                "new_asset_settings": {
                    "playback_policy": ["public"],
                    "passthrough": passthrough_val,
                },
                "cors_origin": cors_origin,
            }
            try:
                response = requests.post(
                    f"{cls.MUX_API_URL}/uploads",
                    json=payload,
                    auth=auth,
                    timeout=10
                )
                if response.status_code == 201:
                    data = response.json().get('data', {})
                    upload_id = data.get('id')
                    upload_url = data.get('url')
                else:
                    logger.error(f"Mux Direct Upload API error {response.status_code}: {response.text}")
            except Exception as exc:
                logger.error(f"Failed to connect to Mux API: {exc}")

        # Fallback / dev mock mode if Mux keys not configured
        if not upload_id:
            upload_id = f"mux_upload_{uuid.uuid4().hex[:16]}"
            upload_url = f"https://api.mux.com/mock-upload/{upload_id}"

        video_asset = VideoAsset.objects.create(
            user=user,
            title=title or "Untitled Video",
            description=description,
            upload_id=upload_id,
            passthrough=passthrough_val,
            status=VideoStatus.WAITING,
            metadata={'cors_origin': cors_origin}
        )

        return {
            'video_asset_id': str(video_asset.id),
            'upload_id': upload_id,
            'upload_url': upload_url,
            'status': video_asset.status,
        }

    @classmethod
    def create_asset_from_url(
        cls,
        user: User,
        input_url: str,
        title: str = "",
        description: str = "",
        passthrough: str = "",
    ) -> VideoAsset:
        """
        Creates a Mux asset from an external video URL (such as an UploadThing stored URL).
        Mux fetches the video, transcodes it for adaptive streaming, and assigns playback IDs.
        """
        user_id_str = str(getattr(user, 'id', 'system'))
        passthrough_val = passthrough or f"user_{user_id_str}_{uuid.uuid4().hex[:8]}"
        auth = cls._get_auth()

        asset_id = None
        playback_id = None
        status = VideoStatus.PREPARING

        if auth:
            payload = {
                "input": [{"url": input_url}],
                "playback_policy": ["public"],
                "passthrough": passthrough_val,
            }
            try:
                response = requests.post(
                    f"{cls.MUX_API_URL}/assets",
                    json=payload,
                    auth=auth,
                    timeout=15,
                )
                if response.status_code in (200, 201):
                    data = response.json().get('data', {})
                    asset_id = data.get('id')
                    p_ids = data.get('playback_ids', [])
                    if p_ids:
                        playback_id = p_ids[0].get('id')
                    status = VideoStatus.PREPARING
                else:
                    logger.error(f"Mux Asset creation error {response.status_code}: {response.text}")
            except Exception as exc:
                logger.error(f"Failed to connect to Mux API for asset creation: {exc}")

        # Fallback / dev mock mode if Mux keys not configured or error
        if not asset_id:
            asset_id = f"mux_asset_{uuid.uuid4().hex[:16]}"
            playback_id = f"playback_{uuid.uuid4().hex[:16]}"
            status = VideoStatus.READY

        video_asset = VideoAsset.objects.create(
            user=user,
            title=title or "Lesson Video",
            description=description,
            asset_id=asset_id,
            playback_id=playback_id,
            passthrough=passthrough_val,
            status=status,
            metadata={
                'source_url': input_url,
                'source_provider': 'uploadthing',
            }
        )
        return video_asset

    @classmethod
    def verify_webhook_signature(cls, raw_body: bytes, header_signature: str) -> bool:
        """
        Verifies Mux-Signature header using HMAC SHA-256.
        Header format: t=1565220304,v1=290680ef0a4023...
        """
        secret = getattr(settings, 'MUX_WEBHOOK_SECRET', '')
        if not secret:
            # If webhook secret is not configured in dev, accept with warning
            return True

        if not header_signature:
            return False

        try:
            parts = dict(pair.split('=', 1) for pair in header_signature.split(','))
            t = parts.get('t')
            v1 = parts.get('v1')
            if not t or not v1:
                return False

            # Prevent replay attacks (> 5 min)
            if abs(int(time.time()) - int(t)) > 300:
                return False

            payload_to_sign = f"{t}.".encode() + raw_body
            expected_sig = hmac.new(
                secret.encode(),
                payload_to_sign,
                hashlib.sha256
            ).hexdigest()

            return hmac.compare_digest(expected_sig, v1)
        except Exception as exc:
            logger.error(f"Mux webhook signature verification failed: {exc}")
            return False

    @classmethod
    def handle_webhook_event(cls, event_data: dict[str, Any]) -> None:
        """
        Processes Mux webhook events:
        - video.upload.asset_created
        - video.asset.ready
        - video.asset.errored
        - video.asset.deleted
        """
        event_type = event_data.get('type')
        data = event_data.get('data', {})

        logger.info(f"Processing Mux Webhook Event: {event_type}")

        if event_type == 'video.upload.asset_created':
            upload_id = data.get('id')
            asset_id = data.get('asset_id')
            if upload_id and asset_id:
                VideoAsset.objects.filter(upload_id=upload_id).update(
                    asset_id=asset_id,
                    status=VideoStatus.PREPARING
                )

        elif event_type == 'video.asset.ready':
            asset_id = data.get('id')
            playback_ids = data.get('playback_ids', [])
            public_playback_id = next(
                (p.get('id') for p in playback_ids if p.get('policy') == 'public'),
                playback_ids[0].get('id') if playback_ids else None
            )
            duration = data.get('duration')
            aspect_ratio = data.get('aspect_ratio', '')
            resolution = data.get('max_stored_resolution', '')
            passthrough = data.get('passthrough', '')

            qs = VideoAsset.objects.filter(asset_id=asset_id)
            if not qs.exists() and passthrough:
                qs = VideoAsset.objects.filter(passthrough=passthrough)

            qs.update(
                asset_id=asset_id,
                playback_id=public_playback_id,
                duration=duration,
                aspect_ratio=aspect_ratio,
                max_stored_resolution=resolution,
                status=VideoStatus.READY
            )

        elif event_type == 'video.asset.errored':
            asset_id = data.get('id')
            errors = data.get('errors', {})
            error_message = json.dumps(errors) if errors else "Mux transcode error"
            VideoAsset.objects.filter(asset_id=asset_id).update(
                status=VideoStatus.ERRORED,
                error_message=error_message
            )

        elif event_type == 'video.asset.deleted':
            asset_id = data.get('id')
            VideoAsset.objects.filter(asset_id=asset_id).update(
                status=VideoStatus.DELETED
            )

    @classmethod
    def get_video_by_id(cls, video_id: str) -> VideoAsset:
        try:
            return VideoAsset.objects.get(id=video_id)
        except VideoAsset.DoesNotExist as err:
            raise NotFound("Vidéo introuvable.") from err

    @classmethod
    def delete_video(cls, user: User, video_id: str) -> None:
        video = cls.get_video_by_id(video_id)
        if video.user and user and video.user_id != user.id and not (user.is_staff or is_superadmin_user(user)):
            raise ValidationError("Vous n'êtes pas propriétaire de cette vidéo.")

        # Delete on Mux if auth configured
        auth = cls._get_auth()
        if auth and video.asset_id:
            try:
                requests.delete(f"{cls.MUX_API_URL}/assets/{video.asset_id}", auth=auth, timeout=5)
            except Exception as exc:
                logger.error(f"Failed to delete Mux asset {video.asset_id}: {exc}")

        video.status = VideoStatus.DELETED
        video.save(update_fields=['status', 'updated_at'])
