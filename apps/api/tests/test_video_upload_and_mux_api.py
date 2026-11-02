
import pytest
from apps.accounts.models.user import User
from apps.media.models.media_asset import MediaAsset, MediaPurpose, MediaStatus
from apps.media.models.video_asset import VideoAsset, VideoStatus
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="videocreator@kodinga.com",
        username="videocreator",
        password="SecurePassword123!",
    )


@pytest.fixture
def dummy_video_file():
    # A small dummy binary MP4 payload
    content = b"\x00\x00\x00 ftypisom\x00\x00\x02\x00isomiso2mp41\x00\x00\x00\x08free"
    return SimpleUploadedFile(
        name="intro_lesson.mp4",
        content=content,
        content_type="video/mp4",
    )


@pytest.mark.django_db
class TestVideoUploadAndMuxAPI:
    def test_video_asset_post_multipart_upload(self, api_client, user, dummy_video_file):
        """
        Frontend sends multipart/form-data video to POST /api/v1/media/videos/
        Stored on UploadThing and ingested into Mux for HLS streaming.
        """
        api_client.force_authenticate(user=user)
        payload = {
            "file": dummy_video_file,
            "title": "Introduction à Django REST Framework",
            "description": "Tutoriel complet sur l'architecture backend",
            "is_public": "true",
        }
        res = api_client.post("/api/v1/media/videos/", payload, format="multipart")
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()["data"]

        assert "id" in data
        assert data["title"] == "Introduction à Django REST Framework"
        assert data["playback_id"]
        assert "hls_url" in data
        assert "source_url" in data
        assert "thumbnail_url" in data
        assert "poster_url" in data
        assert data["status"] in ("ready", "preparing")

        # Verify DB VideoAsset
        video_asset = VideoAsset.objects.get(id=data["id"])
        assert video_asset.user == user
        assert video_asset.playback_id == data["playback_id"]
        assert video_asset.source_url
        assert "media_asset_id" in video_asset.metadata

    def test_video_asset_post_json_ingest(self, api_client, user):
        """
        Frontend sends an UploadThing URL via JSON to POST /api/v1/media/videos/
        """
        api_client.force_authenticate(user=user)
        payload = {
            "file_url": "https://utfs.io/f/kodinga/lesson_video/my_awesome_video.mp4",
            "title": "Architecture Hexagonale",
            "description": "Clean Code & Domain Driven Design",
        }
        res = api_client.post("/api/v1/media/videos/", payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()["data"]

        assert data["title"] == "Architecture Hexagonale"
        assert data["playback_id"]
        assert data["source_url"] == "https://utfs.io/f/kodinga/lesson_video/my_awesome_video.mp4"
        assert f"https://stream.mux.com/{data['playback_id']}.m3u8" in data["hls_url"]

    def test_video_asset_dedicated_ingest_view(self, api_client, user):
        """
        Frontend sends an UploadThing file_url to POST /api/v1/media/videos/ingest/
        """
        api_client.force_authenticate(user=user)
        payload = {
            "file_url": "https://utfs.io/f/kodinga/lesson_video/clean_arch.mp4",
            "title": "Module 3 - Patterns de Conception",
        }
        res = api_client.post("/api/v1/media/videos/ingest/", payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()["data"]
        assert data["playback_id"]
        assert data["hls_url"]
        assert data["source_url"] == "https://utfs.io/f/kodinga/lesson_video/clean_arch.mp4"

    def test_direct_file_upload_video_auto_mux_ingest(self, api_client, user, dummy_video_file):
        """
        When frontend uploads video to generic endpoint POST /api/v1/media/upload/
        It saves to UploadThing AND automatically returns the video_asset Mux reference!
        """
        api_client.force_authenticate(user=user)
        payload = {
            "file": dummy_video_file,
            "purpose": "lesson_video",
            "title": "Cours Vidéo Docker",
        }
        res = api_client.post("/api/v1/media/upload/", payload, format="multipart")
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()["data"]

        assert "file_url" in data
        assert "file_key" in data
        assert "video_asset" in data

        va_data = data["video_asset"]
        assert va_data["playback_id"]
        assert va_data["hls_url"]
        assert va_data["source_url"] == data["file_url"]

    def test_confirm_upload_video_auto_mux_ingest(self, api_client, user):
        """
        When frontend finishes UploadThing presigned upload and calls /api/v1/media/confirm-upload/
        It automatically triggers Mux ingestion and returns video_asset!
        """
        api_client.force_authenticate(user=user)
        pending_asset = MediaAsset.objects.create(
            user=user,
            file_name="lesson_fastapi.mp4",
            file_key="kodinga/lesson_video/fastapi_123.mp4",
            file_size=10485760,
            mime_type="video/mp4",
            purpose=MediaPurpose.LESSON_VIDEO,
            status=MediaStatus.PENDING,
        )

        confirm_payload = {
            "file_key": pending_asset.file_key,
            "file_url": "https://utfs.io/f/kodinga/lesson_video/fastapi_123.mp4",
            "file_size": 10485760,
        }
        res = api_client.post("/api/v1/media/confirm-upload/", confirm_payload, format="json")
        assert res.status_code == status.HTTP_200_OK
        data = res.json()["data"]

        assert data["status"] == "ready"
        assert "video_asset" in data
        va_data = data["video_asset"]
        assert va_data["playback_id"]
        assert va_data["hls_url"]
        assert va_data["source_url"] == confirm_payload["file_url"]

    def test_video_asset_detail_and_list_endpoints(self, api_client, user):
        """
        Test GET /api/v1/media/videos/ and GET /api/v1/media/videos/<video_id>/
        """
        api_client.force_authenticate(user=user)

        video = VideoAsset.objects.create(
            user=user,
            title="Async Django Masterclass",
            playback_id="playback_mock_123456",
            asset_id="asset_mock_123456",
            status=VideoStatus.READY,
            duration=345.5,
            is_public=True,
            metadata={"source_url": "https://utfs.io/f/kodinga/lesson_video/async_django.mp4"},
        )

        # List
        res_list = api_client.get("/api/v1/media/videos/")
        assert res_list.status_code == status.HTTP_200_OK
        results = res_list.json()["data"] if "data" in res_list.json() else res_list.json().get("results", [])
        assert len(results) >= 1
        found = next(v for v in results if v["id"] == str(video.id))
        assert found["playback_id"] == "playback_mock_123456"
        assert found["hls_url"] == "https://stream.mux.com/playback_mock_123456.m3u8"
        assert found["thumbnail_url"] == "https://image.mux.com/playback_mock_123456/thumbnail.webp?width=640&height=360&fit_mode=smart"

        # Detail
        res_detail = api_client.get(f"/api/v1/media/videos/{video.id}/")
        assert res_detail.status_code == status.HTTP_200_OK
        data = res_detail.json()["data"]
        assert data["id"] == str(video.id)
        assert data["hls_url"] == "https://stream.mux.com/playback_mock_123456.m3u8"
        assert data["source_url"] == "https://utfs.io/f/kodinga/lesson_video/async_django.mp4"
        assert data["duration"] == 345.5
