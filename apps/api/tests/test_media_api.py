import json

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.media.models.media_asset import MediaAsset, MediaPurpose, MediaStatus
from apps.media.models.video_asset import VideoAsset, VideoStatus


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="mediauser@kodinga.com",
        username="mediauser",
        password="SecurePassword123!",
    )


@pytest.mark.django_db
class TestMediaAPI:
    def test_generate_upload_url(self, api_client, user):
        api_client.force_authenticate(user=user)
        payload = {
            "file_name": "avatar.png",
            "file_size": 1024 * 500,
            "mime_type": "image/png",
            "purpose": "avatar",
        }
        res = api_client.post("/api/v1/media/upload-url/", payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()["data"]
        assert "upload_url" in data
        assert "file_key" in data
        assert "avatar" in data["file_key"]

    def test_confirm_upload_updates_profile_avatar(self, api_client, user):
        api_client.force_authenticate(user=user)
        # Create pending asset
        asset = MediaAsset.objects.create(
            user=user,
            file_name="avatar.webp",
            file_key="kodinga/avatar/1234_avatar.webp",
            file_size=200000,
            mime_type="image/webp",
            purpose=MediaPurpose.AVATAR,
            status=MediaStatus.PENDING,
        )

        confirm_payload = {
            "file_key": asset.file_key,
            "file_url": "https://cdn.kodinga.com/avatar/1234_avatar.webp",
            "file_size": 200000,
        }
        res = api_client.post(
            "/api/v1/media/confirm-upload/", confirm_payload, format="json"
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["data"]["status"] == "ready"

        # Verify profile avatar updated
        user.profile.refresh_from_db()
        assert (
            user.profile.avatar_url == "https://cdn.kodinga.com/avatar/1234_avatar.webp"
        )

    def test_mux_direct_upload_session(self, api_client, user):
        api_client.force_authenticate(user=user)
        payload = {
            "title": "Django REST Advanced Architecture Lesson",
            "description": "Mastering ViewSets, Services, and Celery",
        }
        res = api_client.post(
            "/api/v1/media/videos/upload-url/", payload, format="json"
        )
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()["data"]
        assert "upload_url" in data
        assert "upload_id" in data
        assert data["status"] == "waiting"

    def test_mux_webhook_processing(self, api_client, user):
        import hmac
        import time

        from django.conf import settings

        video = VideoAsset.objects.create(
            user=user,
            title="Async Python Webinar",
            upload_id="mux_upload_abc123",
            passthrough=f"user_{user.id}_test",
            status=VideoStatus.WAITING,
        )

        secret = getattr(settings, "MUX_WEBHOOK_SECRET", "")

        # 1. Asset created webhook
        webhook_payload_created = {
            "type": "video.upload.asset_created",
            "data": {"id": "mux_upload_abc123", "asset_id": "mux_asset_xyz789"},
        }
        body_1 = json.dumps(webhook_payload_created).encode("utf-8")
        t1 = str(int(time.time()))
        headers_1 = {}
        if secret:
            sig1 = hmac.new(
                secret.encode("utf-8"), f"{t1}.".encode() + body_1, "sha256"
            ).hexdigest()
            headers_1["HTTP_MUX_SIGNATURE"] = f"t={t1},v1={sig1}"

        res = api_client.post(
            "/api/v1/media/mux/webhook/",
            data=body_1,
            content_type="application/json",
            **headers_1,
        )
        assert res.status_code == status.HTTP_200_OK
        video.refresh_from_db()
        assert video.asset_id == "mux_asset_xyz789"
        assert video.status == VideoStatus.PREPARING

        # 2. Asset ready webhook
        webhook_payload_ready = {
            "type": "video.asset.ready",
            "data": {
                "id": "mux_asset_xyz789",
                "playback_ids": [{"id": "playback_stream_111", "policy": "public"}],
                "duration": 125.5,
                "aspect_ratio": "16:9",
                "max_stored_resolution": "1080p",
            },
        }
        body_2 = json.dumps(webhook_payload_ready).encode("utf-8")
        t2 = str(int(time.time()))
        headers_2 = {}
        if secret:
            sig2 = hmac.new(
                secret.encode("utf-8"), f"{t2}.".encode() + body_2, "sha256"
            ).hexdigest()
            headers_2["HTTP_MUX_SIGNATURE"] = f"t={t2},v1={sig2}"

        res2 = api_client.post(
            "/api/v1/media/mux/webhook/",
            data=body_2,
            content_type="application/json",
            **headers_2,
        )
        assert res2.status_code == status.HTTP_200_OK
        video.refresh_from_db()
        assert video.status == VideoStatus.READY
        assert video.playback_id == "playback_stream_111"
        assert video.hls_url == "https://stream.mux.com/playback_stream_111.m3u8"
