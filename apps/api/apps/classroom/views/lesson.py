from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from common.utils.responses import success_response, error_response
from apps.communities.selectors.community_selector import CommunitySelector
from apps.classroom.models.lesson import Lesson
from apps.classroom.models.module import CourseModule
from apps.classroom.selectors.classroom_selector import ClassroomSelector
from apps.classroom.serializers.lesson import (
    LessonCreateUpdateSerializer,
    LessonDetailSerializer,
    LessonSerializer,
)
from apps.classroom.services.classroom_service import ClassroomService


class CourseLessonListView(APIView):
    """
    Create a lesson inside a module (Owner or Admin).
    Supports attaching a Mux video via video_asset_id.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Classroom'],
        summary="Ajouter une leçon à un module ou cours (Owner ou Admin)",
        description="Crée une leçon dans un module. L'ID du module peut être spécifié dans l'URL ou dans le corps JSON via `module_id`.",
        request=LessonCreateUpdateSerializer,
        responses={201: LessonDetailSerializer}
    )
    def post(self, request, slug, course_slug, module_id=None):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        target_module_id = module_id or request.data.get('module_id')
        if not target_module_id:
            return error_response(
                "Le champ 'module_id' est requis pour associer la leçon à un module.",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            module = CourseModule.objects.select_related('course__community').get(
                id=target_module_id,
                course__slug=course_slug,
                course__community=community
            )
        except CourseModule.DoesNotExist:
            return error_response("Module ou cours introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = LessonCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lesson = ClassroomService.create_lesson(
            actor_user=request.user,
            module=module,
            data=serializer.validated_data
        )

        return success_response(
            data=LessonDetailSerializer(lesson).data,
            message="Leçon ajoutée avec succès.",
            status_code=status.HTTP_201_CREATED
        )


class CourseLessonDetailView(APIView):
    """
    Retrieve lesson content and Mux video streaming (Active connected members only), or update/delete lesson.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Classroom'],
        summary="Consulter le contenu d'une leçon et flux vidéo Mux",
        responses={200: LessonDetailSerializer}
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
            user=request.user
        )

        if lesson.is_locked:
            return error_response(
                "Cette leçon est verrouillée. Vous devez terminer les leçons précédentes d'abord.",
                status_code=status.HTTP_403_FORBIDDEN
            )

        return success_response(data=LessonDetailSerializer(lesson).data)

    @extend_schema(
        tags=['Classroom'],
        summary="Modifier une leçon (Owner ou Admin)",
        request=LessonCreateUpdateSerializer,
        responses={200: LessonDetailSerializer}
    )
    def patch(self, request, slug, course_slug, lesson_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            lesson = Lesson.objects.select_related('module__course__community').get(
                id=lesson_id,
                module__course__slug=course_slug,
                module__course__community=community
            )
        except Exception:
            return error_response("Leçon introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = LessonCreateUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        updated = ClassroomService.update_lesson(
            actor_user=request.user,
            lesson=lesson,
            data=serializer.validated_data
        )

        return success_response(
            data=LessonDetailSerializer(updated).data,
            message="Leçon mise à jour avec succès."
        )

    @extend_schema(
        tags=['Classroom'],
        summary="Supprimer une leçon (Owner ou Admin)",
        responses={200: None}
    )
    def delete(self, request, slug, course_slug, lesson_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            lesson = Lesson.objects.select_related('module__course__community').get(
                id=lesson_id,
                module__course__slug=course_slug,
                module__course__community=community
            )
        except Exception:
            return error_response("Leçon introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        ClassroomService.delete_lesson(request.user, lesson)
        return success_response(message="Leçon supprimée avec succès.")
