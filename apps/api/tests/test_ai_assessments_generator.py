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
