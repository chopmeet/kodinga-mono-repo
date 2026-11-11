from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from apps.ai.serializers import (
    ApplyAssessmentSerializer,
    GenerateExerciseRequestSerializer,
    GenerateQuizRequestSerializer,
)
from apps.ai.services.assessment_generator_service import AssessmentGeneratorService
from apps.ai.views.base import ai_success_response
from apps.classroom.models.course import Course
from apps.classroom.models.lesson import Lesson
from apps.classroom.permissions import IsCommunityClassroomManager
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)


def resolve_course(request, course_slug: str, community_slug: str = None) -> Course:
    """
    Resolves a course cleanly handling cases where multiple communities have courses
    with the exact same slug (since slug uniqueness is unique_together with community).
    """
    comm_slug = (
        community_slug
        or request.query_params.get("community")
        or (request.data.get("community") if isinstance(request.data, dict) else None)
    )

    qs = Course.objects.select_related("community")
    if comm_slug:
        return get_object_or_404(qs, community__slug=comm_slug, slug=course_slug)

    matching = list(qs.filter(slug=course_slug))
    if not matching:
        return get_object_or_404(Course, slug=course_slug)
    if len(matching) == 1:
        return matching[0]

    # Multiple courses share this slug. Filter by communities the requester manages or owns.
    user_managed_ids = set(
        CommunityMember.objects.filter(
            user=request.user,
            status=MembershipStatus.ACTIVE,
            role__in=[CommunityRole.OWNER, CommunityRole.ADMIN],
        ).values_list("community_id", flat=True)
    )
    user_managed_ids.update(
        Course.objects.filter(
            slug=course_slug, community__owner=request.user
        ).values_list("community_id", flat=True)
    )

    scoped = [c for c in matching if c.community_id in user_managed_ids]
    if len(scoped) == 1:
        return scoped[0]

    raise ValidationError(
        f"Plusieurs cours partagent le slug '{course_slug}'. Veuillez spécifier la communauté via l'URL "
        f"'/api/v1/communities/<community_slug>/courses/{course_slug}/...' ou le paramètre ?community=<slug>."
    )


class GenerateQuizView(APIView):
    """
    Generates QCM multiple choice questions from a lesson's content or video transcript.
    Strictly verifies that the lesson belongs to the specified course and community.
    """

    permission_classes = [permissions.IsAuthenticated, IsCommunityClassroomManager]

    def post(self, request, course_slug: str, community_slug: str = None):
        course = resolve_course(
            request, course_slug=course_slug, community_slug=community_slug
        )
        self.check_object_permissions(request, course)

        serializer = GenerateQuizRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lesson_id = serializer.validated_data["lesson_id"]
        lesson = get_object_or_404(
            Lesson.objects.select_related("module__course__community"),
            id=lesson_id,
            module__course=course,
        )

        questions, is_ai_generated = AssessmentGeneratorService.generate_quiz(
            lesson=lesson,
            num_questions=serializer.validated_data.get("question_count", 3),
            difficulty=serializer.validated_data.get("difficulty", "intermediate"),
            language="fr",
        )

        resp_data = {
            "lesson_id": str(lesson.id),
            "lesson_title": lesson.title,
            "questions": questions,
            "is_ai_generated": is_ai_generated,
        }
        if not is_ai_generated:
            resp_data["warning"] = (
                "Génération IA temporairement indisponible. Modèle de base fourni à titre indicatif."
            )

        return ai_success_response(resp_data, status_code=status.HTTP_200_OK)


class GenerateCodeExerciseView(APIView):
    """
    Generates a coding challenge with starter code, unit tests, and solution.
    Strictly verifies that the lesson belongs to the specified course and community.
    """

    permission_classes = [permissions.IsAuthenticated, IsCommunityClassroomManager]

    def post(self, request, course_slug: str, community_slug: str = None):
        course = resolve_course(
            request, course_slug=course_slug, community_slug=community_slug
        )
        self.check_object_permissions(request, course)

        serializer = GenerateExerciseRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lesson_id = serializer.validated_data["lesson_id"]
        lesson = get_object_or_404(
            Lesson.objects.select_related("module__course__community"),
            id=lesson_id,
            module__course=course,
        )

        exercise, is_ai_generated = AssessmentGeneratorService.generate_code_exercise(
            lesson=lesson,
            difficulty=serializer.validated_data.get("difficulty", "intermediate"),
            language=serializer.validated_data.get("language", "python"),
        )

        resp_data = {
            "lesson_id": str(lesson.id),
            "lesson_title": lesson.title,
            "exercise": exercise,
            "is_ai_generated": is_ai_generated,
        }
        if not is_ai_generated:
            resp_data["warning"] = (
                "Génération IA temporairement indisponible. Modèle de base fourni à titre indicatif."
            )

        return ai_success_response(resp_data, status_code=status.HTTP_200_OK)


class ApplyAssessmentView(APIView):
    """
    Applies and saves generated assessment (quiz or code exercise) to the lesson.
    Strictly verifies that the lesson belongs to the specified course and community.
    """

    permission_classes = [permissions.IsAuthenticated, IsCommunityClassroomManager]

    def post(self, request, course_slug: str, community_slug: str = None):
        course = resolve_course(
            request, course_slug=course_slug, community_slug=community_slug
        )
        self.check_object_permissions(request, course)

        serializer = ApplyAssessmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lesson_id = serializer.validated_data["lesson_id"]
        assessment_type = serializer.validated_data["assessment_type"]
        payload = serializer.validated_data["payload"]

        lesson = get_object_or_404(
            Lesson.objects.select_related("module__course__community"),
            id=lesson_id,
            module__course=course,
        )

        if assessment_type == "quiz":
            updated_lesson = AssessmentGeneratorService.apply_quiz_to_lesson(
                lesson=lesson,
                quiz_data=payload,
            )
        else:
            updated_lesson = AssessmentGeneratorService.apply_code_exercise_to_lesson(
                lesson=lesson,
                exercise_data=payload,
            )

        resp_data = {
            "lesson_id": str(updated_lesson.id),
            "lesson_type": updated_lesson.lesson_type,
        }
        return ai_success_response(
            resp_data,
            message=f"Évaluation '{assessment_type}' appliquée avec succès à la leçon.",
            status_code=status.HTTP_200_OK,
        )
