import pytest
from apps.accounts.models.user import User
from apps.classroom.models.course import Course, CourseLevel
from apps.classroom.models.lesson import Lesson, LessonType
from apps.classroom.models.module import CourseModule
from apps.classroom.models.progress import CourseEnrollment
from apps.communities.models.community import Community, CommunityPrivacy
from apps.communities.models.settings import CommunitySettings
from apps.media.models.video_asset import VideoAsset, VideoStatus
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from rest_framework import status
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_owner(db):
    return User.objects.create_user(
        email="owner_classroom@kodinga.com",
        username="owner_classroom",
        password="SecurePassword123!",
    )


@pytest.fixture
def user_admin(db):
    return User.objects.create_user(
        email="admin_classroom@kodinga.com",
        username="admin_classroom",
        password="SecurePassword123!",
    )


@pytest.fixture
def user_student(db):
    return User.objects.create_user(
        email="student@kodinga.com",
        username="student_dev",
        password="SecurePassword123!",
    )


@pytest.fixture
def user_outsider(db):
    return User.objects.create_user(
        email="outsider@kodinga.com",
        username="outsider_dev",
        password="SecurePassword123!",
    )


@pytest.fixture
def test_community(db, user_owner, user_admin, user_student):
    community = Community.objects.create(
        name="Django Masters",
        slug="django-masters",
        owner=user_owner,
        privacy_type=CommunityPrivacy.PUBLIC,
    )
    CommunitySettings.objects.create(community=community)

    # Owner
    CommunityMember.objects.create(
        community=community,
        user=user_owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    # Admin
    CommunityMember.objects.create(
        community=community,
        user=user_admin,
        role=CommunityRole.ADMIN,
        status=MembershipStatus.ACTIVE,
    )
    # Student / regular member
    CommunityMember.objects.create(
        community=community,
        user=user_student,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    return community


@pytest.fixture
def test_video_asset(db, user_owner):
    return VideoAsset.objects.create(
        user=user_owner,
        title="Django Ninja Video",
        upload_id="mock_upload_123",
        asset_id="mock_asset_123",
        playback_id="playback_xyz789",
        duration=360.0,
        status=VideoStatus.READY,
    )


@pytest.mark.django_db
class TestClassroomAPI:
    def test_manager_can_create_course_and_member_cannot(
        self, api_client, user_owner, user_admin, user_student, test_community
    ):
        # 1. Regular member cannot create course (403)
        api_client.force_authenticate(user=user_student)
        res_fail = api_client.post(
            f"/api/v1/communities/{test_community.slug}/courses/",
            {
                "title": "Django Advanced",
                "description": "Deep dive into Django internals",
                "level": CourseLevel.ADVANCED,
            },
            format="json",
        )
        assert res_fail.status_code == status.HTTP_403_FORBIDDEN

        # 2. Admin can create course (201)
        api_client.force_authenticate(user=user_admin)
        res_admin = api_client.post(
            f"/api/v1/communities/{test_community.slug}/courses/",
            {
                "title": "Django Rest APIs",
                "description": "Build high-performance REST APIs",
                "level": CourseLevel.INTERMEDIATE,
                "is_published": True,
                "is_sequential": True,
            },
            format="json",
        )
        assert res_admin.status_code == status.HTTP_201_CREATED
        assert res_admin.json()["data"]["slug"] == "django-rest-apis"

        # 3. Owner can create course (201)
        api_client.force_authenticate(user=user_owner)
        res_owner = api_client.post(
            f"/api/v1/communities/{test_community.slug}/courses/",
            {
                "title": "Celery & Redis Architecture",
                "description": "Asynchronous tasks at scale",
                "level": CourseLevel.ADVANCED,
                "is_published": True,
            },
            format="json",
        )
        assert res_owner.status_code == status.HTTP_201_CREATED

    def test_course_modules_lessons_and_video_streaming(
        self, api_client, user_owner, user_student, test_community, test_video_asset
    ):
        api_client.force_authenticate(user=user_owner)

        # Create Course
        res_course = api_client.post(
            f"/api/v1/communities/{test_community.slug}/courses/",
            {
                "title": "Fullstack Python",
                "slug": "fullstack-python",
                "is_published": True,
                "is_sequential": True,
            },
            format="json",
        )
        assert res_course.status_code == status.HTTP_201_CREATED

        # Create Module
        res_module = api_client.post(
            f"/api/v1/communities/{test_community.slug}/courses/fullstack-python/modules/",
            {
                "title": "Module 1 : Fundamentals",
                "description": "Core concepts",
                "order": 0,
            },
            format="json",
        )
        assert res_module.status_code == status.HTTP_201_CREATED
        module_id = res_module.json()["data"]["id"]

        # Create Lesson 1 with Mux Video Asset attached
        res_lesson1 = api_client.post(
            f"/api/v1/communities/{test_community.slug}/courses/fullstack-python/modules/{module_id}/lessons/",
            {
                "title": "Introduction to Web Protocols",
                "slug": "intro-web-protocols",
                "lesson_type": LessonType.VIDEO,
                "video_asset_id": str(test_video_asset.id),
                "order": 0,
            },
            format="json",
        )
        assert res_lesson1.status_code == status.HTTP_201_CREATED
        lesson1_data = res_lesson1.json()["data"]
        lesson1_id = lesson1_data["id"]
        assert (
            lesson1_data["video_hls_url"]
            == "https://stream.mux.com/playback_xyz789.m3u8"
        )
        assert lesson1_data["duration_seconds"] == 360

        # Create Lesson 2 (Sequential)
        res_lesson2 = api_client.post(
            f"/api/v1/communities/{test_community.slug}/courses/fullstack-python/modules/{module_id}/lessons/",
            {
                "title": "Deep Dive into HTTP/2 and WebSockets",
                "slug": "deep-dive-http2",
                "lesson_type": LessonType.ARTICLE,
                "content": "# Deep Dive\nExplaining HTTP/2 multiplexing...",
                "duration_seconds": 600,
                "order": 1,
            },
            format="json",
        )
        assert res_lesson2.status_code == status.HTTP_201_CREATED
        lesson2_id = res_lesson2.json()["data"]["id"]

        # 4. Student view: Lesson 1 is unlocked, Lesson 2 is LOCKED
        api_client.force_authenticate(user=user_student)

        # GET Course Detail
        res_detail = api_client.get(
            f"/api/v1/communities/{test_community.slug}/courses/fullstack-python/"
        )
        assert res_detail.status_code == status.HTTP_200_OK
        modules_res = res_detail.json()["data"]["modules"]
        lessons_res = modules_res[0]["lessons"]
        assert lessons_res[0]["is_locked"] is False
        assert lessons_res[1]["is_locked"] is True

        # Student tries to read Lesson 2 directly -> 403 Forbidden (Locked)
        res_read_locked = api_client.get(
            f"/api/v1/communities/{test_community.slug}/courses/fullstack-python/lessons/{lesson2_id}/"
        )
        assert res_read_locked.status_code == status.HTTP_403_FORBIDDEN

        # Student reads Lesson 1 -> 200 OK with HLS stream
        res_read_unlocked = api_client.get(
            f"/api/v1/communities/{test_community.slug}/courses/fullstack-python/lessons/{lesson1_id}/"
        )
        assert res_read_unlocked.status_code == status.HTTP_200_OK
        assert (
            res_read_unlocked.json()["data"]["video_hls_url"]
            == "https://stream.mux.com/playback_xyz789.m3u8"
        )

        # Student completes Lesson 1
        res_progress = api_client.post(
            f"/api/v1/communities/{test_community.slug}/courses/fullstack-python/lessons/{lesson1_id}/progress/",
            {
                "is_completed": True,
                "last_watched_second": 360,
                "notes": "Great lesson!",
            },
            format="json",
        )
        assert res_progress.status_code == status.HTTP_200_OK
        assert res_progress.json()["data"]["is_completed"] is True

        # Check enrollment progress updated to 50%
        enrollment = CourseEnrollment.objects.get(
            course__slug="fullstack-python", user=user_student
        )
        assert enrollment.progress_percent == 50.0

        # Now Lesson 2 is UNLOCKED!
        res_read_lesson2 = api_client.get(
            f"/api/v1/communities/{test_community.slug}/courses/fullstack-python/lessons/{lesson2_id}/"
        )
        assert res_read_lesson2.status_code == status.HTTP_200_OK
        assert res_read_lesson2.json()["data"]["content"].startswith("# Deep Dive")

    def test_rich_text_and_images_lesson(self, api_client, user_owner, test_community):
        api_client.force_authenticate(user=user_owner)

        # 1. Create Course and Module
        res_course = api_client.post(
            f"/api/v1/communities/{test_community.slug}/courses/",
            {
                "title": "System Design Handbook",
                "slug": "system-design-handbook",
                "is_published": True,
            },
            format="json",
        )
        assert res_course.status_code == status.HTTP_201_CREATED

        res_module = api_client.post(
            f"/api/v1/communities/{test_community.slug}/courses/system-design-handbook/modules/",
            {"title": "Patterns d'Architecture"},
            format="json",
        )
        module_id = res_module.json()["data"]["id"]

        # 2. Create rich text lesson with formatted markdown & images (no video)
        rich_markdown = """# CQRS & Event Sourcing Architecture

Ce guide détaille l'implémentation d'une architecture orientée événements.

## Schéma Conceptuel
![Architecture Diagram](https://storage.kodinga.com/assets/cqrs-diagram.png)

```python
class OrderCreatedEvent:
    def __init__(self, order_id: str, amount: float):
        self.order_id = order_id
        self.amount = amount
```

> **Note importante** : La synchronisation du modèle se fait via Kafka.
"""
        images_payload = [
            {
                "url": "https://storage.kodinga.com/assets/cqrs-diagram.png",
                "caption": "Flux CQRS : Séparation commandes et requêtes",
                "alt": "Diagramme CQRS Event Sourcing",
            },
            {
                "url": "https://storage.kodinga.com/assets/read-model-sync.png",
                "caption": "Consistance à terme (Eventual Consistency)",
                "alt": "Synchronisation base lecture",
            },
        ]

        res_lesson = api_client.post(
            f"/api/v1/communities/{test_community.slug}/courses/system-design-handbook/modules/{module_id}/lessons/",
            {
                "title": "Guide Pratique CQRS et Event Sourcing",
                "slug": "guide-cqrs-event-sourcing",
                "lesson_type": LessonType.TEXT,
                "content_format": "markdown",
                "content": rich_markdown,
                "cover_image_url": "https://storage.kodinga.com/assets/cqrs-cover.webp",
                "images": images_payload,
                "attachments": [
                    {
                        "name": "cheat-sheet-cqrs.pdf",
                        "url": "https://storage.kodinga.com/assets/cqrs.pdf",
                        "size_bytes": 1024000,
                    }
                ],
            },
            format="json",
        )
        assert res_lesson.status_code == status.HTTP_201_CREATED
        data = res_lesson.json()["data"]

        assert data["lesson_type"] == LessonType.TEXT
        assert data["content_format"] == "markdown"
        assert (
            data["cover_image_url"]
            == "https://storage.kodinga.com/assets/cqrs-cover.webp"
        )
        assert data["has_images"] is True
        assert data["has_video"] is False
        assert len(data["images"]) == 2
        assert data["reading_time_minutes"] >= 1
        assert "min de lecture" in data["estimated_duration_display"]
        assert len(data["attachments"]) == 1

        # 3. Read Lesson detail
        lesson_id = data["id"]
        res_get = api_client.get(
            f"/api/v1/communities/{test_community.slug}/courses/system-design-handbook/lessons/{lesson_id}/"
        )
        assert res_get.status_code == status.HTTP_200_OK
        detail_data = res_get.json()["data"]
        assert "# CQRS & Event Sourcing Architecture" in detail_data["content"]
        assert (
            detail_data["cover_image_url"]
            == "https://storage.kodinga.com/assets/cqrs-cover.webp"
        )
        assert (
            detail_data["images"][0]["caption"]
            == "Flux CQRS : Séparation commandes et requêtes"
        )

        # 4. Direct lesson creation with module_id in payload
        direct_url = (
            f"/api/v1/communities/{test_community.slug}/courses/"
            "system-design-handbook/lessons/"
        )
        res_direct_lesson = api_client.post(
            direct_url,
            {
                "module_id": module_id,
                "title": "Saga Pattern & Distributed Transactions",
                "lesson_type": LessonType.TEXT,
                "content": "# Saga Pattern\nManaging distributed state...",
            },
            format="json",
        )
        assert res_direct_lesson.status_code == status.HTTP_201_CREATED
        assert (
            res_direct_lesson.json()["data"]["slug"]
            == "saga-pattern-distributed-transactions"
        )

    def test_only_connected_active_members_can_see_courses_and_progress(
        self, api_client, user_owner, user_student, user_outsider, test_community
    ):
        # 1. Setup a published course with a module and lesson
        course = Course.objects.create(
            community=test_community,
            author=user_owner,
            title="Docker for Production",
            slug="docker-for-production",
            is_published=True,
            is_sequential=False,
        )
        module = CourseModule.objects.create(
            course=course,
            title="Module 1: Containers",
            order=0,
        )
        lesson = Lesson.objects.create(
            module=module,
            title="Container Networking",
            slug="container-networking",
            lesson_type=LessonType.TEXT,
            content="Networking fundamentals with bridge and overlay networks.",
            order=0,
        )

        courses_url = f"/api/v1/communities/{test_community.slug}/courses/"
        course_detail_url = (
            f"/api/v1/communities/{test_community.slug}/courses/{course.slug}/"
        )
        lesson_detail_url = (
            f"/api/v1/communities/{test_community.slug}/courses/"
            f"{course.slug}/lessons/{lesson.id}/"
        )
        progress_url = (
            f"/api/v1/communities/{test_community.slug}/courses/"
            f"{course.slug}/lessons/{lesson.id}/progress/"
        )
        enroll_url = (
            f"/api/v1/communities/{test_community.slug}/courses/{course.slug}/enroll/"
        )

        # 2. Case: Anonymous / Unconnected visitor -> 401 Unauthorized
        api_client.logout()

        res_anon_courses = api_client.get(courses_url)
        assert res_anon_courses.status_code == status.HTTP_401_UNAUTHORIZED

        res_anon_detail = api_client.get(course_detail_url)
        assert res_anon_detail.status_code == status.HTTP_401_UNAUTHORIZED

        res_anon_lesson = api_client.get(lesson_detail_url)
        assert res_anon_lesson.status_code == status.HTTP_401_UNAUTHORIZED

        res_anon_progress = api_client.post(
            progress_url, {"is_completed": True}, format="json"
        )
        assert res_anon_progress.status_code == status.HTTP_401_UNAUTHORIZED

        res_anon_enroll = api_client.post(enroll_url, format="json")
        assert res_anon_enroll.status_code == status.HTTP_401_UNAUTHORIZED

        # 3. Case: Authenticated Outsider (non-member) -> 403 Forbidden
        api_client.force_authenticate(user=user_outsider)

        res_out_courses = api_client.get(courses_url)
        assert res_out_courses.status_code == status.HTTP_403_FORBIDDEN
        assert "membre actif" in res_out_courses.json().get("message", "")

        res_out_detail = api_client.get(course_detail_url)
        assert res_out_detail.status_code == status.HTTP_403_FORBIDDEN
        assert "membre actif" in res_out_detail.json().get("message", "")

        res_out_lesson = api_client.get(lesson_detail_url)
        assert res_out_lesson.status_code == status.HTTP_403_FORBIDDEN

        res_out_progress = api_client.post(
            progress_url, {"is_completed": True}, format="json"
        )
        assert res_out_progress.status_code == status.HTTP_403_FORBIDDEN

        res_out_enroll = api_client.post(enroll_url, format="json")
        assert res_out_enroll.status_code == status.HTTP_403_FORBIDDEN

        # 4. Case: Connected member with PENDING membership -> 403 Forbidden
        user_pending = User.objects.create_user(
            email="pending@kodinga.com",
            username="pending_user",
            password="SecurePassword123!",
        )
        CommunityMember.objects.create(
            community=test_community,
            user=user_pending,
            role=CommunityRole.MEMBER,
            status=MembershipStatus.PENDING,
        )
        api_client.force_authenticate(user=user_pending)

        res_pend_courses = api_client.get(courses_url)
        assert res_pend_courses.status_code == status.HTTP_403_FORBIDDEN

        res_pend_detail = api_client.get(course_detail_url)
        assert res_pend_detail.status_code == status.HTTP_403_FORBIDDEN

        # 5. Case: Connected Active Member -> 200 OK
        api_client.force_authenticate(user=user_student)

        res_member_courses = api_client.get(courses_url)
        assert res_member_courses.status_code == status.HTTP_200_OK
        results = res_member_courses.json()["results"]
        assert len(results) >= 1
        assert any(c["slug"] == "docker-for-production" for c in results)

        res_member_detail = api_client.get(course_detail_url)
        assert res_member_detail.status_code == status.HTTP_200_OK
        assert res_member_detail.json()["data"]["slug"] == "docker-for-production"

        res_member_enroll = api_client.post(enroll_url, format="json")
        assert res_member_enroll.status_code == status.HTTP_200_OK

        res_member_progress = api_client.post(
            progress_url, {"is_completed": True, "notes": "Done!"}, format="json"
        )
        assert res_member_progress.status_code == status.HTTP_200_OK
        assert res_member_progress.json()["data"]["is_completed"] is True

    def test_get_course_modules_and_single_module_and_unpaginated_courses(
        self, api_client, test_community, user_student, user_owner
    ):
        course = Course.objects.create(
            community=test_community,
            author=user_owner,
            title="FastAPI Microservices Architecture",
            slug="fastapi-microservices",
            level=CourseLevel.INTERMEDIATE,
            is_published=True,
            order=1,
        )
        module_1 = CourseModule.objects.create(
            course=course,
            title="Module 1: Setup & Dockerization",
            description="Configuration du dev environment",
            order=1,
        )
        CourseModule.objects.create(
            course=course,
            title="Module 2: Async Handlers & Pydantic v2",
            description="Création des routes",
            order=2,
        )
        Lesson.objects.create(
            module=module_1,
            title="Lesson 1.1: Docker Compose Multi-services",
            slug="docker-compose-multi-services",
            content="Docker setup guide",
            lesson_type=LessonType.TEXT,
            order=1,
        )

        api_client.force_authenticate(user=user_student)

        # 1. Test get all courses for a community with ?all=true
        res_courses = api_client.get(
            f"/api/v1/communities/{test_community.slug}/courses/?all=true"
        )
        assert res_courses.status_code == status.HTTP_200_OK
        courses_data = res_courses.json()["data"]
        assert isinstance(courses_data, list)
        assert any(c["slug"] == "fastapi-microservices" for c in courses_data)

        # 2. Test get all modules for a course
        modules_url = (
            f"/api/v1/communities/{test_community.slug}/courses/{course.slug}/modules/"
        )
        res_modules = api_client.get(modules_url)
        assert res_modules.status_code == status.HTTP_200_OK
        modules_data = res_modules.json()["data"]
        assert len(modules_data) == 2
        assert modules_data[0]["title"] == "Module 1: Setup & Dockerization"
        assert len(modules_data[0]["lessons"]) == 1
        assert (
            modules_data[0]["lessons"][0]["title"]
            == "Lesson 1.1: Docker Compose Multi-services"
        )
        assert modules_data[1]["title"] == "Module 2: Async Handlers & Pydantic v2"

        # 3. Test get single module by ID
        single_module_url = (
            f"/api/v1/communities/{test_community.slug}/courses/"
            f"{course.slug}/modules/{module_1.id}/"
        )
        res_single = api_client.get(single_module_url)
        assert res_single.status_code == status.HTTP_200_OK
        single_data = res_single.json()["data"]
        assert single_data["id"] == str(module_1.id)
        assert single_data["title"] == "Module 1: Setup & Dockerization"
        assert len(single_data["lessons"]) == 1
        assert single_data["lessons"][0]["slug"] == "docker-compose-multi-services"
