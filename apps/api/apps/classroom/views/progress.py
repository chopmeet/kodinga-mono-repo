from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.classroom.models.progress import LessonProgress
from apps.classroom.selectors.classroom_selector import ClassroomSelector
from apps.classroom.serializers.progress import (
    LessonProgressSerializer,
    LessonProgressUpdateSerializer,
    QuizSubmitRequestSerializer,
)
from apps.classroom.services.progress_service import ProgressService
from apps.communities.selectors.community_selector import CommunitySelector
from common.utils.responses import error_response, success_response


class LessonProgressView(APIView):
    """
    Update learner progress for a lesson (completion, video playback position, notes)
    and return consolidated course completion & congratulations screen data (BE-12).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Classroom'],
        summary="Mettre à jour la progression sur une leçon (complétion, timestamp vidéo)",
        request=LessonProgressUpdateSerializer,
        responses={200: LessonProgressSerializer}
    )
    def post(self, request, slug, course_slug, lesson_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        lesson = ClassroomSelector.get_lesson_by_id(
            community=community,
            course_slug=course_slug,
            lesson_id=str(lesson_id),
            user=request.user
        )

        serializer = LessonProgressUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            progress = ProgressService.update_progress(
                user=request.user,
                lesson=lesson,
                is_completed=data.get('is_completed'),
                last_watched_second=data.get('last_watched_second'),
                notes=data.get('notes')
            )
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_403_FORBIDDEN)

        if getattr(progress, 'just_completed_course', False):
            status_msg = f"Félicitations ! Vous avez terminé la formation « {lesson.module.course.title} » 🎉"
        elif progress.is_completed:
            status_msg = "Leçon marquée comme complétée !"
        else:
            status_msg = "Progression enregistrée."

        return success_response(
            data=LessonProgressSerializer(progress).data,
            message=status_msg
        )


class LessonQuizSubmitView(APIView):
    """
    GET / POST /api/v1/communities/<slug>/courses/<course_slug>/lessons/<lesson_id>/quiz/submit/
    Submits learner answers for a lesson quiz, calculates the score (single & multiple choice),
    persists the attempt, and marks the lesson completed if passed (BE-10 & BE-12).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Classroom'],
        summary="Consulter le dernier résultat obtenu au quiz d'une leçon",
        responses={200: None},
    )
    def get(self, request, slug, course_slug, lesson_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        lesson = ClassroomSelector.get_lesson_by_id(
            community=community,
            course_slug=course_slug,
            lesson_id=str(lesson_id),
            user=request.user,
        )
        progress = LessonProgress.objects.filter(lesson=lesson, user=request.user).first()
        if not progress or not progress.quiz_last_submission:
            return success_response(
                data={
                    "lesson_id": str(lesson.id),
                    "has_attempted": False,
                    "quiz_attempts_count": 0,
                    "quiz_score": None,
                    "quiz_passed": False,
                    "last_submission": None,
                }
            )
        return success_response(
            data={
                "lesson_id": str(lesson.id),
                "has_attempted": True,
                "quiz_attempts_count": progress.quiz_attempts_count,
                "quiz_score": progress.quiz_score,
                "quiz_passed": progress.quiz_passed,
                "last_submission": progress.quiz_last_submission,
            }
        )

    @extend_schema(
        tags=['Classroom'],
        summary="Soumettre les réponses d'un quiz et obtenir la note et la correction",
        request=QuizSubmitRequestSerializer,
        responses={200: None},
    )
    def post(self, request, slug, course_slug, lesson_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        lesson = ClassroomSelector.get_lesson_by_id(
            community=community,
            course_slug=course_slug,
            lesson_id=str(lesson_id),
            user=request.user,
        )

        serializer = QuizSubmitRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = ProgressService.submit_quiz(
            user=request.user,
            lesson=lesson,
            submitted_answers=serializer.validated_data["answers"],
        )

        msg = (
            f"Quiz réussi ({result['score_percent']}%) !"
            if result["passed"]
            else f"Score insuffisant ({result['score_percent']}% / {result['passing_score']}% requis). Vous pouvez réessayer."
        )
        return success_response(data=result, message=msg)
