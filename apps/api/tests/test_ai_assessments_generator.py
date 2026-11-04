import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.classroom.models.course import Course
from apps.classroom.models.lesson import Lesson, LessonType
from apps.classroom.models.module import CourseModule
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def instructor(db):
    return User.objects.create_user(
        email="instructor_ai@kodinga.com",
        username="instructor_ai",
        password="SecurePassword123!",
    )


@pytest.fixture
def course_and_lesson(db, instructor):
    comm = Community.objects.create(
        name="Python Academy",
        slug="python-academy",
        owner=instructor,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.FREE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=instructor,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    course = Course.objects.create(
        community=comm,
        author=instructor,
        title="Introduction à Python et aux algorithmes",
        slug="intro-python-algos",
    )
    module = CourseModule.objects.create(
        course=course,
        title="Module 1: Les bases de la syntaxe",
        order=1,
    )
    lesson = Lesson.objects.create(
        module=module,
        title="Les fonctions récursives en Python",
        slug="les-fonctions-recursives",
        content="Une fonction récursive est une fonction qui s'appelle elle-même jusqu'à atteindre un cas de base.",
        lesson_type=LessonType.TEXT,
    )
    return comm, course, module, lesson, instructor


@pytest.mark.django_db
def test_generate_quiz_api(api_client, course_and_lesson):
    _, course, _, lesson, instructor = course_and_lesson

    api_client.force_authenticate(user=instructor)
    url = f"/api/v1/courses/{course.slug}/ai/generate-quiz/"

    payload = {
        "lesson_id": str(lesson.id),
        "question_count": 2,
        "difficulty": "intermediate",
    }
    res = api_client.post(url, payload, format="json")
    assert res.status_code == status.HTTP_200_OK
    assert res.data["lesson_id"] == str(lesson.id)
    assert len(res.data["questions"]) >= 1


@pytest.mark.django_db
def test_generate_code_exercise_api(api_client, course_and_lesson):
    _, course, _, lesson, instructor = course_and_lesson

    api_client.force_authenticate(user=instructor)
    url = f"/api/v1/courses/{course.slug}/ai/generate-exercise/"

    payload = {
        "lesson_id": str(lesson.id),
        "difficulty": "beginner",
        "language": "python",
    }
    res = api_client.post(url, payload, format="json")
    assert res.status_code == status.HTTP_200_OK
    assert "starter_code" in res.data["exercise"]
    assert "solution_code" in res.data["exercise"]


@pytest.mark.django_db
def test_apply_assessment_api(api_client, course_and_lesson):
    _, course, _, lesson, instructor = course_and_lesson

    api_client.force_authenticate(user=instructor)
    url = f"/api/v1/courses/{course.slug}/ai/apply-assessment/"

    payload = {
        "lesson_id": str(lesson.id),
        "assessment_type": "quiz",
        "payload": {
            "questions": [
                {
                    "question": "Qu'est-ce qu'une condition d'arrêt en récursivité ?",
                    "options": ["Le cas de base", "Une boucle infinie", "Une erreur de syntaxe", "Un import"],
                    "correct_index": 0,
                    "explanation": "Le cas de base évite le dépassement de pile (stack overflow).",
                }
            ]
        },
    }
    res = api_client.post(url, payload, format="json")
    assert res.status_code == status.HTTP_200_OK
    lesson.refresh_from_db()
    assert lesson.lesson_type == LessonType.QUIZ
    assert "questions" in lesson.quiz_data


@pytest.mark.django_db
def test_assessment_endpoints_reject_lesson_from_another_course(api_client, course_and_lesson):
    comm, course, _, _, instructor = course_and_lesson

    # Create a separate, foreign course and lesson in the same or another community
    foreign_course = Course.objects.create(
        community=comm,
        author=instructor,
        title="Cours de JavaScript Moderne",
        slug="js-moderne",
    )
    foreign_module = CourseModule.objects.create(
        course=foreign_course,
        title="Module JS",
        order=1,
    )
    foreign_lesson = Lesson.objects.create(
        module=foreign_module,
        title="Les Promises en JavaScript",
        slug="promises-js",
        content="Une Promise représente une opération asynchrone.",
        lesson_type=LessonType.TEXT,
    )

    api_client.force_authenticate(user=instructor)

    # 1. generate-quiz should return 404 because foreign_lesson does not belong to course
    url_quiz = f"/api/v1/courses/{course.slug}/ai/generate-quiz/"
    res_quiz = api_client.post(url_quiz, {"lesson_id": str(foreign_lesson.id)}, format="json")
    assert res_quiz.status_code == status.HTTP_404_NOT_FOUND

    # 2. generate-exercise should return 404
    url_ex = f"/api/v1/courses/{course.slug}/ai/generate-exercise/"
    res_ex = api_client.post(url_ex, {"lesson_id": str(foreign_lesson.id), "language": "javascript"}, format="json")
    assert res_ex.status_code == status.HTTP_404_NOT_FOUND

    # 3. apply-assessment should return 404 and NOT modify foreign_lesson
    url_apply = f"/api/v1/courses/{course.slug}/ai/apply-assessment/"
    payload = {
        "lesson_id": str(foreign_lesson.id),
        "assessment_type": "quiz",
        "payload": {"questions": []},
    }
    res_apply = api_client.post(url_apply, payload, format="json")
    assert res_apply.status_code == status.HTTP_404_NOT_FOUND

    foreign_lesson.refresh_from_db()
    assert foreign_lesson.lesson_type == LessonType.TEXT  # Not modified!
