import contextlib
import hashlib
import hmac
import json
import logging
import os
import time
import uuid
from typing import Any, Optional

import requests
from django.conf import settings
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.accounts.models.user import User
from apps.media.models.video_asset import VideoAsset, VideoStatus
from common.permissions.base import is_superadmin_user

logger = logging.getLogger("kodinga.media")


class MuxVideoService:
    """
    Manages Mux Video Direct Uploads, Webhook Processing, and Playback Asset Tracking.
    """

    MUX_API_URL = "https://api.mux.com/video/v1"
    ALLOWED_POST_VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm"}
    ALLOWED_POST_VIDEO_MIMES = {"video/mp4", "video/quicktime", "video/webm"}

    @classmethod
    def _get_auth(cls) -> Optional[tuple]:
        token_id = getattr(settings, "MUX_TOKEN_ID", "")
        token_secret = getattr(settings, "MUX_TOKEN_SECRET", "")
        if token_id and token_secret:
            return (token_id, token_secret)
        return None

    @classmethod
    def validate_video_constraints(
        cls,
        file_name: str = "",
        file_size: Optional[int] = None,
        mime_type: str = "",
        purpose: str = "post_video",
    ) -> None:
        """
        Validates video format (MP4, MOV, WEBM) and size (max 100 MB for post videos).
        """
        if file_name:
            ext = os.path.splitext(file_name)[1].lower()
            if ext and ext not in cls.ALLOWED_POST_VIDEO_EXTENSIONS:
                raise ValidationError(
                    f"Format vidéo '{ext}' non autorisé. Formats acceptés : MP4, MOV, WEBM."
                )

        if mime_type:
            norm_mime = mime_type.split(";")[0].strip().lower()
            if (
                norm_mime
                and norm_mime != "application/octet-stream"
                and norm_mime not in cls.ALLOWED_POST_VIDEO_MIMES
            ):
                raise ValidationError(
                    f"Type MIME vidéo '{norm_mime}' non autorisé. Types acceptés : video/mp4, video/quicktime, video/webm."
                )

        if file_size is not None:
            if file_size <= 0:
                raise ValidationError(
                    "La taille du fichier vidéo doit être supérieure à 0 octet."
                )
            if purpose == "lesson_video":
                max_bytes = int(
                    getattr(settings, "VIDEO_MAX_FILE_SIZE_BYTES", 500 * 1024 * 1024)
                )
            else:
                max_bytes = int(
                    getattr(settings, "POST_VIDEO_MAX_SIZE_BYTES", 128 * 1024 * 1024)
                )
            if file_size > max_bytes:
                raise ValidationError("uploader une video < 128Mo")

    @classmethod
    def create_direct_upload(
        cls,
        user: User,
        title: str = "",
        description: str = "",
        passthrough: str = "",
        cors_origin: str = "*",
        file_name: str = "",
        file_size: Optional[int] = None,
        mime_type: str = "",
        purpose: str = "post_video",
    ) -> dict[str, Any]:
        """
        Creates a direct upload URL via Mux REST API and registers a waiting VideoAsset.
        """
        cls.validate_video_constraints(
            file_name=file_name,
            file_size=file_size,
            mime_type=mime_type,
            purpose=purpose,
        )
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
                    f"{cls.MUX_API_URL}/uploads", json=payload, auth=auth, timeout=10
                )
                if response.status_code == 201:
                    data = response.json().get("data", {})
                    upload_id = data.get("id")
                    upload_url = data.get("url")
                else:
                    logger.error(
                        f"Mux Direct Upload API error {response.status_code}: {response.text}"
                    )
            except Exception as exc:
                logger.error(f"Failed to connect to Mux API: {exc}")

        # Fallback / dev mock mode if Mux keys not configured
        if not upload_id:
            upload_id = f"mux_upload_{uuid.uuid4().hex[:16]}"
            upload_url = f"https://api.mux.com/mock-upload/{upload_id}"

        video_asset = VideoAsset.objects.create(
            user=user,
            title=title or file_name or "Untitled Video",
            description=description,
            upload_id=upload_id,
            passthrough=passthrough_val,
            status=VideoStatus.WAITING,
            metadata={
                "cors_origin": cors_origin,
                "file_name": file_name or title or "video.mp4",
                "file_size": file_size or 0,
                "mime_type": mime_type or "video/mp4",
                "purpose": purpose,
            },
        )

        return {
            "video_asset_id": str(video_asset.id),
            "upload_id": upload_id,
            "upload_url": upload_url,
            "status": video_asset.status,
            "normalized_status": video_asset.normalized_status,
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
        user_id_str = str(getattr(user, "id", "system"))
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
                    data = response.json().get("data", {})
                    asset_id = data.get("id")
                    p_ids = data.get("playback_ids", [])
                    if p_ids:
                        playback_id = p_ids[0].get("id")
                    status = VideoStatus.PREPARING
                else:
                    logger.error(
                        f"Mux Asset creation error {response.status_code}: {response.text}"
                    )
            except Exception as exc:
                logger.error(f"Failed to connect to Mux API for asset creation: {exc}")

        # Fallback / dev mock mode if Mux keys not configured or error
        mux_fallback = False
        if not asset_id:
            asset_id = f"mux_asset_{uuid.uuid4().hex[:16]}"
            playback_id = f"playback_{uuid.uuid4().hex[:16]}"
            status = VideoStatus.READY
            mux_fallback = True

        metadata = {
            "source_url": input_url,
            "source_provider": "uploadthing",
        }
        if mux_fallback:
            # Flag consumed by callers: the asset was NOT ingested by Mux,
            # playback must use the raw source URL instead of stream.mux.com.
            metadata["mux_fallback"] = True

        video_asset = VideoAsset.objects.create(
            user=user,
            title=title or "Lesson Video",
            description=description,
            asset_id=asset_id,
            playback_id=playback_id,
            passthrough=passthrough_val,
            status=status,
            metadata=metadata,
        )
        return video_asset

    @classmethod
    def verify_webhook_signature(cls, raw_body: bytes, header_signature: str) -> bool:
        """
        Verifies Mux-Signature header using HMAC SHA-256.
        Header format: t=1565220304,v1=290680ef0a4023...
        """
        secret = getattr(settings, "MUX_WEBHOOK_SECRET", "")
        if not secret:
            # If webhook secret is not configured in dev, accept with warning
            return True

        if not header_signature:
            return False

        try:
            parts = dict(pair.split("=", 1) for pair in header_signature.split(","))
            t = parts.get("t")
            v1 = parts.get("v1")
            if not t or not v1:
                return False

            # Prevent replay attacks (> 5 min)
            if abs(int(time.time()) - int(t)) > 300:
                return False

            payload_to_sign = f"{t}.".encode() + raw_body
            expected_sig = hmac.new(
                secret.encode(), payload_to_sign, hashlib.sha256
            ).hexdigest()

            return hmac.compare_digest(expected_sig, v1)
        except Exception as exc:
            logger.error(f"Mux webhook signature verification failed: {exc}")
            return False

    @classmethod
    def handle_webhook_event(cls, event_data: dict[str, Any]) -> dict[str, Any]:
        """
        Processes Mux webhook events idempotently:
        - video.upload.asset_created
        - video.asset.created
        - video.asset.ready
        - video.asset.errored
        - video.upload.errored
        - video.asset.deleted
        """
        event_id = str(event_data.get("id") or "").strip()
        event_type = event_data.get("type")
        data = (
            event_data.get("data", {})
            if isinstance(event_data.get("data"), dict)
            else {}
        )

        logger.info("Processing Mux Webhook Event: %s (id=%s)", event_type, event_id)

        upload_id = data.get("upload_id") or (
            data.get("id")
            if event_type and event_type.startswith("video.upload.")
            else None
        )
        asset_id = data.get("asset_id") or (
            data.get("id")
            if event_type and event_type.startswith("video.asset.")
            else None
        )
        passthrough = data.get("passthrough") or (
            data.get("new_asset_settings", {}) or {}
        ).get("passthrough", "")

        video_asset = None
        if asset_id:
            video_asset = VideoAsset.objects.filter(asset_id=asset_id).first()
        if not video_asset and upload_id:
            video_asset = VideoAsset.objects.filter(upload_id=upload_id).first()
        if not video_asset and passthrough:
            video_asset = VideoAsset.objects.filter(passthrough=passthrough).first()

        if not video_asset:
            logger.warning(
                "Mux webhook ignored: no matching VideoAsset found for event %s",
                event_type,
            )
            return {"status": "ignored", "reason": "asset_not_found"}

        meta = (
            dict(video_asset.metadata) if isinstance(video_asset.metadata, dict) else {}
        )
        processed_ids = list(meta.get("processed_webhook_ids") or [])
        if event_id and event_id in processed_ids:
            logger.info(
                "Mux webhook %s already processed for video %s (idempotent skip).",
                event_id,
                video_asset.id,
            )
            return {
                "status": "already_processed",
                "video_asset_id": str(video_asset.id),
            }

        if event_id:
            processed_ids.append(event_id)
            meta["processed_webhook_ids"] = processed_ids[-50:]
        meta["last_webhook_event"] = {
            "id": event_id,
            "type": event_type,
            "received_at": int(time.time()),
        }

        if event_type in ("video.upload.asset_created", "video.asset.created"):
            if asset_id and not video_asset.asset_id:
                video_asset.asset_id = asset_id
            # Protect state transitions: never downgrade a READY or DELETED asset
            if video_asset.status not in (VideoStatus.READY, VideoStatus.DELETED):
                video_asset.status = VideoStatus.PREPARING
            video_asset.metadata = meta
            video_asset.save(
                update_fields=["asset_id", "status", "metadata", "updated_at"]
            )

        elif event_type == "video.asset.ready":
            playback_ids = data.get("playback_ids", [])
            public_playback_id = next(
                (p.get("id") for p in playback_ids if p.get("policy") == "public"),
                playback_ids[0].get("id") if playback_ids else None,
            )
            if asset_id:
                video_asset.asset_id = asset_id
            if public_playback_id:
                video_asset.playback_id = public_playback_id
            if data.get("duration") is not None:
                video_asset.duration = data.get("duration")
            if data.get("aspect_ratio"):
                video_asset.aspect_ratio = data.get("aspect_ratio")
            if data.get("max_stored_resolution"):
                video_asset.max_stored_resolution = data.get("max_stored_resolution")
                video_asset.resolution = data.get("max_stored_resolution")
            if video_asset.status != VideoStatus.DELETED:
                video_asset.status = VideoStatus.READY
            video_asset.error_message = ""
            video_asset.metadata = meta
            video_asset.save()
            cls._broadcast_video_update(video_asset)

        elif event_type in ("video.asset.errored", "video.upload.errored"):
            errors = data.get("errors") or data.get("error") or {}
            error_message = (
                json.dumps(errors) if errors else "Erreur de transcodage vidéo Mux."
            )
            if asset_id and not video_asset.asset_id:
                video_asset.asset_id = asset_id
            if video_asset.status != VideoStatus.DELETED:
                video_asset.status = VideoStatus.ERRORED
            video_asset.error_message = error_message
            video_asset.metadata = meta
            video_asset.save(
                update_fields=[
                    "asset_id",
                    "status",
                    "error_message",
                    "metadata",
                    "updated_at",
                ]
            )
            cls._broadcast_video_update(video_asset)

        elif event_type in ("video.asset.deleted", "video.upload.cancelled"):
            video_asset.status = VideoStatus.DELETED
            video_asset.metadata = meta
            video_asset.save(update_fields=["status", "metadata", "updated_at"])

        return {
            "status": "processed",
            "video_asset_id": str(video_asset.id),
            "video_status": video_asset.status,
        }

    @classmethod
    def sync_asset_from_mux(cls, video_asset: VideoAsset) -> VideoAsset:
        """
        Polls Mux REST API synchronously to refresh the VideoAsset state when webhooks are delayed
        or when running in environments without ingress webhooks.
        """
        if not video_asset or video_asset.status in (VideoStatus.READY, VideoStatus.DELETED, VideoStatus.ERRORED):
            return video_asset

        auth = cls._get_auth()
        if not auth:
            # Dev / test environment without live Mux credentials:
            # If upload was initiated or asset is waiting, auto-resolve to READY with mock playback ID
            if video_asset.upload_id and "mock" in video_asset.upload_id:
                video_asset.status = VideoStatus.READY
                if not video_asset.playback_id:
                    video_asset.playback_id = f"mock_{video_asset.id.hex[:12]}"
                video_asset.save(update_fields=["status", "playback_id", "updated_at"])
            return video_asset

        meta = dict(video_asset.metadata) if isinstance(video_asset.metadata, dict) else {}

        # 1. If we have upload_id but no asset_id yet, query the direct upload
        if video_asset.upload_id and not video_asset.asset_id:
            try:
                res = requests.get(f"{cls.MUX_API_URL}/uploads/{video_asset.upload_id}", auth=auth, timeout=5)
                if res.status_code == 200:
                    u_data = res.json().get("data", {})
                    asset_id = u_data.get("asset_id")
                    if asset_id:
                        video_asset.asset_id = asset_id
                        if video_asset.status != VideoStatus.READY:
                            video_asset.status = VideoStatus.PREPARING
            except Exception as exc:
                logger.warning(f"Error querying Mux upload {video_asset.upload_id}: {exc}")

        # 2. If we have asset_id, query the asset state directly
        if video_asset.asset_id:
            try:
                res = requests.get(f"{cls.MUX_API_URL}/assets/{video_asset.asset_id}", auth=auth, timeout=5)
                if res.status_code == 200:
                    a_data = res.json().get("data", {})
                    mux_status = a_data.get("status")
                    playback_ids = a_data.get("playback_ids", [])
                    public_playback_id = next(
                        (p.get("id") for p in playback_ids if p.get("policy") == "public"),
                        playback_ids[0].get("id") if playback_ids else None,
                    )
                    if public_playback_id:
                        video_asset.playback_id = public_playback_id
                    if a_data.get("duration") is not None:
                        video_asset.duration = a_data.get("duration")
                    if a_data.get("aspect_ratio"):
                        video_asset.aspect_ratio = a_data.get("aspect_ratio")
                    if a_data.get("max_stored_resolution"):
                        video_asset.max_stored_resolution = a_data.get("max_stored_resolution")
                        video_asset.resolution = a_data.get("max_stored_resolution")

                    if mux_status == "ready":
                        video_asset.status = VideoStatus.READY
                        video_asset.error_message = ""
                    elif mux_status == "errored":
                        video_asset.status = VideoStatus.ERRORED
                        video_asset.error_message = json.dumps(a_data.get("errors", {}))
                    elif mux_status == "preparing":
                        video_asset.status = VideoStatus.PREPARING

                    video_asset.metadata = meta
                    video_asset.save()
                    if video_asset.status == VideoStatus.READY:
                        cls._broadcast_video_update(video_asset)
            except Exception as exc:
                logger.warning(f"Error querying Mux asset {video_asset.asset_id}: {exc}")

        return video_asset

    @classmethod
    def _broadcast_video_update(cls, video_asset: VideoAsset) -> None:
        with contextlib.suppress(Exception):
            from realtime.broadcast import send_group_event

            payload = video_asset.to_unified_dict()
            if video_asset.user_id:
                send_group_event(
                    f"user_{video_asset.user_id}",
                    "video.status.changed",
                    payload,
                )
            if hasattr(video_asset, "attached_posts"):
                for post in video_asset.attached_posts.all():
                    send_group_event(
                        f"community_{post.community_id}",
                        "post.video.updated",
                        {"post_id": str(post.id), "video": payload},
                    )
                    send_group_event(
                        f"post_{post.id}",
                        "post.video.updated",
                        {"post_id": str(post.id), "video": payload},
                    )
                    from realtime.broadcast import broadcast_post_updated

                    broadcast_post_updated(post)

    @classmethod
    def get_video_by_id(cls, video_id: str) -> VideoAsset:
        try:
            return VideoAsset.objects.get(id=video_id)
        except VideoAsset.DoesNotExist as err:
            raise NotFound("Vidéo introuvable.") from err

    @classmethod
    def delete_video(cls, user: User, video_id: str) -> None:
        video = cls.get_video_by_id(video_id)
        if (
            video.user
            and user
            and video.user_id != user.id
            and not (user.is_staff or is_superadmin_user(user))
        ):
            raise PermissionDenied("Vous n'êtes pas propriétaire de cette vidéo.")

        # Delete on Mux if auth configured
        auth = cls._get_auth()
        if auth and video.asset_id:
            try:
                requests.delete(
                    f"{cls.MUX_API_URL}/assets/{video.asset_id}", auth=auth, timeout=5
                )
            except Exception as exc:
                logger.error(f"Failed to delete Mux asset {video.asset_id}: {exc}")

        # Also clean up underlying UploadThing MediaAsset if linked and not used elsewhere
        meta = video.metadata if isinstance(video.metadata, dict) else {}
        media_asset_id = meta.get("media_asset_id")
        if media_asset_id:
            with contextlib.suppress(Exception):
                from apps.media.services.uploadthing_service import UploadThingService

                UploadThingService.delete_asset(
                    user=video.user or user, asset_id=str(media_asset_id)
                )

        video.status = VideoStatus.DELETED
        video.save(update_fields=["status", "updated_at"])
