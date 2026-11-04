from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai.serializers import (
    ApplyAssessmentSerializer,
    GenerateExerciseRequestSerializer,
    GenerateQuizRequestSerializer,
)
from apps.ai.services.assessment_generator_service import AssessmentGeneratorService
from apps.classroom.models.course import Course
from apps.classroom.models.lesson import Lesson
from apps.classroom.permissions import IsCommunityClassroomManager


class GenerateQuizView(APIView):
    """
    Generates QCM multiple choice questions from a lesson's content or video transcript.
    Strictly verifies that the lesson belongs to the specified course.
    """

    permission_classes = [permissions.IsAuthenticated, IsCommunityClassroomManager]

    def post(self, request, course_slug: str):
        course = get_object_or_404(Course.objects.select_related("community"), slug=course_slug)
        self.check_object_permissions(request, course)

        serializer = GenerateQuizRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lesson_id = serializer.validated_data["lesson_id"]
        lesson = get_object_or_404(
            Lesson.objects.select_related("module__course__community"),
            id=lesson_id,
            module__course=course,
        )

        questions = AssessmentGeneratorService.generate_quiz(
            lesson=lesson,
            num_questions=serializer.validated_data.get("question_count", 3),
            difficulty=serializer.validated_data.get("difficulty", "intermediate"),
            language="fr",
        )

        return Response(
            {
                "lesson_id": str(lesson.id),
                "lesson_title": lesson.title,
                "questions": questions,
            },
            status=status.HTTP_200_OK,
        )


class GenerateCodeExerciseView(APIView):
    """
    Generates a coding challenge with starter code, unit tests, and solution.
    Strictly verifies that the lesson belongs to the specified course.
    """

    permission_classes = [permissions.IsAuthenticated, IsCommunityClassroomManager]

    def post(self, request, course_slug: str):
        course = get_object_or_404(Course.objects.select_related("community"), slug=course_slug)
        self.check_object_permissions(request, course)

        serializer = GenerateExerciseRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lesson_id = serializer.validated_data["lesson_id"]
        lesson = get_object_or_404(
            Lesson.objects.select_related("module__course__community"),
            id=lesson_id,
            module__course=course,
        )

        exercise = AssessmentGeneratorService.generate_code_exercise(
            lesson=lesson,
            difficulty=serializer.validated_data.get("difficulty", "intermediate"),
            language=serializer.validated_data.get("language", "python"),
        )

        return Response(
            {
                "lesson_id": str(lesson.id),
                "lesson_title": lesson.title,
                "exercise": exercise,
            },
            status=status.HTTP_200_OK,
        )


class ApplyAssessmentView(APIView):
    """
    Applies and saves generated assessment (quiz or code exercise) to the lesson.
    Strictly verifies that the lesson belongs to the specified course.
    """

    permission_classes = [permissions.IsAuthenticated, IsCommunityClassroomManager]

    def post(self, request, course_slug: str):
        course = get_object_or_404(Course.objects.select_related("community"), slug=course_slug)
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

        return Response(
            {
                "message": f"Évaluation '{assessment_type}' appliquée avec succès à la leçon.",
                "lesson_id": str(updated_lesson.id),
                "lesson_type": updated_lesson.lesson_type,
            },
            status=status.HTTP_200_OK,
        )
