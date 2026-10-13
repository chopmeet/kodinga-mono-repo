from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from common.utils.responses import success_response, error_response
from apps.communities.selectors.community_selector import CommunitySelector
from apps.classroom.selectors.classroom_selector import ClassroomSelector
from apps.classroom.serializers.progress import (
    LessonProgressSerializer,
    LessonProgressUpdateSerializer,
)
from apps.classroom.services.progress_service import ProgressService


class LessonProgressView(APIView):
    """
    Update learner progress for a lesson (completion, video playback position, notes).
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

        status_msg = "Leçon marquée comme complétée !" if progress.is_completed else "Progression enregistrée."
        return success_response(
            data=LessonProgressSerializer(progress).data,
            message=status_msg
        )
