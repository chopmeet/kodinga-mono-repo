from unittest.mock import MagicMock, patch

import pytest
from apps.accounts.models.user import User
from apps.classroom.admin import LessonAdmin, LessonAdminForm
from apps.classroom.models.course import Course, CourseLevel
from apps.classroom.models.lesson import Lesson, LessonType
from apps.classroom.models.module import CourseModule
from apps.classroom.services.classroom_service import ClassroomService
from apps.communities.models.category import CommunityCategory
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.media.models.video_asset import VideoAsset, VideoStatus
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from django.contrib.admin.sites import AdminSite
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def classroom_setup(db):
    owner = User.objects.create_user(
        username="course_owner",
        email="owner@kodinga.com",
        password="password123",
    )
    student = User.objects.create_user(
        username="student_user",
        email="student@kodinga.com",
        password="password123",
    )
    category = CommunityCategory.objects.create(name="Dev Tech", slug="dev-tech")
    community = Community.objects.create(
        name="Python & Web Mastery",
        slug="python-web-mastery",
        owner=owner,
        category=category,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.FREE,
    )
    CommunityMember.objects.create(
        user=owner,
        community=community,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    CommunityMember.objects.create(
        user=student,
        community=community,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )

    course = Course.objects.create(
        community=community,
        author=owner,
        title="Apprendre Django de Zéro",
        slug="apprendre-django",
        level=CourseLevel.BEGINNER,
        is_published=True,
    )
    module = CourseModule.objects.create(
        course=course,
        title="Module 1: Les Fondations",
        order=1,
    )
    lesson = Lesson.objects.create(
        module=module,
        title="Introduction et Architecture",
        slug="intro-architecture",
        content="# Bienvenue dans le cours Django",
        order=1,
    )

    return {
        "owner": owner,
        "student": student,
        "community": community,
        "course": course,
        "module": module,
        "lesson": lesson,
    }


@pytest.mark.django_db
class TestClassroomUploadThingAndMux:
    def test_attach_video_to_lesson_service(self, classroom_setup):
        """
        Verify that attach_video_to_lesson uploads file to UploadThing, ingests into Mux,
        stores the VideoAsset and UploadThing source URL, and updates lesson_type.
        """
        owner = classroom_setup["owner"]
        lesson = classroom_setup["lesson"]

        mock_ut_url = "https://5nk6cottcm.ufs.sh/f/test_lesson_vid_xyz.mp4"
        fake_video_file = SimpleUploadedFile(
            "intro.mp4",
            b"fake mp4 binary content",
            content_type="video/mp4",
        )

        with (
            patch(
                "apps.media.services.uploadthing_service.UploadThingService.upload_file_direct"
            ) as mock_ut,
            patch(
                "apps.media.services.mux_service.MuxVideoService.create_asset_from_url"
            ) as mock_mux,
        ):
            mock_ut.return_value = {
                "file_key": "test_lesson_vid_xyz.mp4",
                "file_url": mock_ut_url,
                "file_name": "intro.mp4",
                "file_size": 25,
            }

            fake_asset = VideoAsset.objects.create(
                user=owner,
                title="Intro Video",
                asset_id="mux_asset_abc123",
                playback_id="mux_playback_xyz789",
                status=VideoStatus.READY,
                duration=120.0,
                metadata={"source_url": mock_ut_url},
            )
            mock_mux.return_value = fake_asset

            updated = ClassroomService.attach_video_to_lesson(
                actor_user=owner,
                lesson=lesson,
                video_file=fake_video_file,
            )

            mock_ut.assert_called_once()
            mock_mux.assert_called_once_with(
                user=owner,
                input_url=mock_ut_url,
                title=f"{lesson.title} (Vidéo)",
                description=f"Cours : {lesson.module.course.title} | Leçon : {lesson.title}",
            )

            assert updated.lesson_type == LessonType.VIDEO
            assert updated.video_asset == fake_asset
            assert updated.video_playback_id == "mux_playback_xyz789"
            assert (
                updated.video_hls_url
                == "https://stream.mux.com/mux_playback_xyz789.m3u8"
            )
            assert updated.video_source_url == mock_ut_url

    def test_add_and_remove_attachment_service(self, classroom_setup):
        """
        Verify that add_attachment_to_lesson uploads document to UploadThing and stores metadata in lesson.attachments.
        """
        owner = classroom_setup["owner"]
        lesson = classroom_setup["lesson"]

        mock_ut_url = "https://5nk6cottcm.ufs.sh/f/cheatsheet_python.pdf"
        fake_doc = SimpleUploadedFile(
            "cheatsheet.pdf",
            b"%PDF-1.4 sample pdf content",
            content_type="application/pdf",
        )

        with patch(
            "apps.media.services.uploadthing_service.UploadThingService.upload_file_direct"
        ) as mock_ut:
            mock_ut.return_value = {
                "file_key": "cheatsheet_python.pdf",
                "file_url": mock_ut_url,
                "file_name": "cheatsheet.pdf",
                "file_size": 200,
            }

            item = ClassroomService.add_attachment_to_lesson(
                actor_user=owner,
                lesson=lesson,
                attachment_file=fake_doc,
            )

            mock_ut.assert_called_once()
            assert item["name"] == "cheatsheet.pdf"
            assert item["url"] == mock_ut_url
            assert item["mime_type"] == "application/pdf"
            assert "id" in item

            lesson.refresh_from_db()
            assert len(lesson.attachments) == 1
            assert lesson.attachments[0]["url"] == mock_ut_url

            # Now test removing attachment
            ClassroomService.remove_attachment_from_lesson(
                actor_user=owner,
                lesson=lesson,
                attachment_id_or_url=item["id"],
            )
            lesson.refresh_from_db()
            assert len(lesson.attachments) == 0

    def test_api_video_upload_endpoint(self, api_client, classroom_setup):
        """
        Test POST /api/v1/classroom/communities/<slug>/courses/<course_slug>/lessons/<lesson_id>/video/
        """
        owner = classroom_setup["owner"]
        community = classroom_setup["community"]
        course = classroom_setup["course"]
        lesson = classroom_setup["lesson"]

        api_client.force_authenticate(user=owner)
        url = f"/api/v1/communities/{community.slug}/courses/{course.slug}/lessons/{lesson.id}/video/"

        mock_ut_url = "https://5nk6cottcm.ufs.sh/f/api_uploaded_video.mp4"
        video_payload = SimpleUploadedFile(
            "api_lesson.mp4", b"some video bytes", content_type="video/mp4"
        )

        with (
            patch(
                "apps.media.services.uploadthing_service.UploadThingService.upload_file_direct"
            ) as mock_ut,
            patch(
                "apps.media.services.mux_service.MuxVideoService.create_asset_from_url"
            ) as mock_mux,
        ):
            mock_ut.return_value = {
                "file_key": "api_uploaded_video.mp4",
                "file_url": mock_ut_url,
                "file_name": "api_lesson.mp4",
                "file_size": 100,
            }
            fake_asset = VideoAsset.objects.create(
                user=owner,
                title="API Lesson Vidéo",
                asset_id="mux_asset_api_999",
                playback_id="playback_api_999",
                status=VideoStatus.READY,
                duration=60.0,
                metadata={"source_url": mock_ut_url},
            )
            mock_mux.return_value = fake_asset

            res = api_client.post(url, {"video": video_payload}, format="multipart")
            assert res.status_code == status.HTTP_200_OK
            data = res.json().get("data", {})
            assert data["video_playback_id"] == "playback_api_999"
            assert (
                data["video_hls_url"] == "https://stream.mux.com/playback_api_999.m3u8"
            )
            assert data["video_source_url"] == mock_ut_url
            assert data["lesson_type"] == "video"

    def test_api_attachment_upload_and_delete_endpoints(
        self, api_client, classroom_setup
    ):
        """
        Test POST and DELETE on /api/v1/communities/<slug>/courses/<course_slug>/lessons/<lesson_id>/attachments/
        """
        owner = classroom_setup["owner"]
        community = classroom_setup["community"]
        course = classroom_setup["course"]
        lesson = classroom_setup["lesson"]

        api_client.force_authenticate(user=owner)
        upload_url = f"/api/v1/communities/{community.slug}/courses/{course.slug}/lessons/{lesson.id}/attachments/"

        mock_ut_url = "https://5nk6cottcm.ufs.sh/f/slides_deck.pdf"
        doc_file = SimpleUploadedFile(
            "slides.pdf", b"pdf content", content_type="application/pdf"
        )

        with patch(
            "apps.media.services.uploadthing_service.UploadThingService.upload_file_direct"
        ) as mock_ut:
            mock_ut.return_value = {
                "file_key": "slides_deck.pdf",
                "file_url": mock_ut_url,
                "file_name": "slides.pdf",
                "file_size": 1234,
            }

            res = api_client.post(upload_url, {"file": doc_file}, format="multipart")
            assert res.status_code == status.HTTP_201_CREATED
            res_data = res.json().get("data", {})
            added = res_data.get("added_attachments", [])
            assert len(added) == 1
            att_id = added[0]["id"]
            assert added[0]["url"] == mock_ut_url

            # Delete endpoint
            delete_url = f"/api/v1/communities/{community.slug}/courses/{course.slug}/lessons/{lesson.id}/attachments/{att_id}/"
            del_res = api_client.delete(delete_url)
            assert del_res.status_code == status.HTTP_200_OK

            lesson.refresh_from_db()
            assert len(lesson.attachments) == 0

    def test_lesson_admin_form_and_save_model(self, classroom_setup):
        """
        Verify Django Admin LessonAdminForm and save_model execution with UploadThing and Mux.
        """
        owner = classroom_setup["owner"]
        lesson = classroom_setup["lesson"]

        form = LessonAdminForm()
        assert "video_file" in form.fields
        assert "attachment_file" in form.fields
        assert "cover_image_file" in form.fields

        admin_site = AdminSite()
        lesson_admin = LessonAdmin(Lesson, admin_site)

        # Mock request with admin user
        request = MagicMock()
        request.user = owner

        # Mock form data with video and attachment files
        mock_form = MagicMock()
        mock_video = SimpleUploadedFile(
            "demo.mp4", b"video data", content_type="video/mp4"
        )
        mock_attachment = SimpleUploadedFile(
            "notes.zip", b"zip data", content_type="application/zip"
        )
        mock_cover = SimpleUploadedFile(
            "cover.png", b"image data", content_type="image/png"
        )

        mock_form.cleaned_data = {
            "video_file": mock_video,
            "attachment_file": mock_attachment,
            "cover_image_file": mock_cover,
        }

        with (
            patch(
                "apps.media.services.uploadthing_service.UploadThingService.upload_file_direct"
            ) as mock_ut,
            patch(
                "apps.media.services.mux_service.MuxVideoService.create_asset_from_url"
            ) as mock_mux,
        ):

            def ut_side_effect(**kwargs):
                purpose = kwargs.get("purpose", "")
                mapping = {
                    "general": {
                        "file_url": "https://5nk6cottcm.ufs.sh/f/admin_video.mp4",
                        "file_size": 5000,
                    },
                    "lesson_attachment": {
                        "file_url": "https://5nk6cottcm.ufs.sh/f/admin_notes.zip",
                        "file_size": 2000,
                    },
                    "classroom_cover": {
                        "file_url": "https://5nk6cottcm.ufs.sh/f/admin_cover.png",
                        "file_size": 1000,
                    },
                }
                return mapping.get(
                    purpose,
                    {
                        "file_url": "https://5nk6cottcm.ufs.sh/f/default.dat",
                        "file_size": 100,
                    },
                )

            mock_ut.side_effect = ut_side_effect

            fake_asset = VideoAsset.objects.create(
                user=owner,
                title="Admin Video",
                asset_id="mux_admin_123",
                playback_id="playback_admin_123",
                status=VideoStatus.READY,
                duration=90.0,
                metadata={"source_url": "https://5nk6cottcm.ufs.sh/f/admin_video.mp4"},
            )
            mock_mux.return_value = fake_asset

            lesson_admin.save_model(request, lesson, mock_form, change=True)

            assert (
                lesson.cover_image_url == "https://5nk6cottcm.ufs.sh/f/admin_cover.png"
            )
            assert lesson.video_asset == fake_asset
            assert lesson.lesson_type == LessonType.VIDEO
            assert len(lesson.attachments) == 1
            assert lesson.attachments[0]["name"] == "notes.zip"
            assert (
                lesson.attachments[0]["url"]
                == "https://5nk6cottcm.ufs.sh/f/admin_notes.zip"
            )
