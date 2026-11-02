from common.utils.responses import error_response, success_response
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.classroom.models.module import CourseModule
from apps.classroom.selectors.classroom_selector import ClassroomSelector
from apps.classroom.serializers.module import (
    CourseModuleCreateUpdateSerializer,
    CourseModuleDetailSerializer,
    CourseModuleSerializer,
)
from apps.classroom.services.classroom_service import ClassroomService
from apps.communities.selectors.community_selector import CommunitySelector


class CourseModuleListView(APIView):
    """
    List all modules of a course or create a pedagogical module inside a course (Owner or Admin).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Classroom'],
        summary="Lister tous les modules d'un cours",
        parameters=[
            OpenApiParameter(name='include_lessons', description="Inclure les leçons du module (défaut: true)", required=False, type=bool),
        ],
        responses={200: CourseModuleDetailSerializer(many=True)}
    )
    def get(self, request, slug, course_slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        modules = ClassroomSelector.list_course_modules(
            community=community,
            course_slug=course_slug,
            user=request.user
        )

        include_lessons = request.query_params.get('include_lessons', 'true').lower() in ['true', '1']
        serializer_class = CourseModuleDetailSerializer if include_lessons else CourseModuleSerializer
        serializer = serializer_class(modules, many=True)
        return success_response(data=serializer.data)

    @extend_schema(
        tags=['Classroom'],
        summary="Ajouter un module à un cours (Owner ou Admin)",
        request=CourseModuleCreateUpdateSerializer,
        responses={201: CourseModuleSerializer}
    )
    def post(self, request, slug, course_slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        course = ClassroomSelector.get_course_by_slug(community, course_slug, user=request.user)

        serializer = CourseModuleCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        module = ClassroomService.create_module(
            actor_user=request.user,
            course=course,
            data=serializer.validated_data
        )

        return success_response(
            data=CourseModuleSerializer(module).data,
            message="Module pédagogique créé avec succès.",
            status_code=status.HTTP_201_CREATED
        )


class CourseModuleDetailView(APIView):
    """
    Retrieve, update or delete a pedagogical module (Owner or Admin).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Classroom'],
        summary="Obtenir les détails d'un module et ses leçons",
        responses={200: CourseModuleDetailSerializer}
    )
    def get(self, request, slug, course_slug, module_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        module = ClassroomSelector.get_module_by_id(
            community=community,
            course_slug=course_slug,
            module_id=str(module_id),
            user=request.user
        )

        serializer = CourseModuleDetailSerializer(module)
        return success_response(data=serializer.data)

    @extend_schema(
        tags=['Classroom'],
        summary="Modifier un module (Owner ou Admin)",
        request=CourseModuleCreateUpdateSerializer,
        responses={200: CourseModuleSerializer}
    )
    def patch(self, request, slug, course_slug, module_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            module = CourseModule.objects.select_related('course__community').get(
                id=module_id,
                course__slug=course_slug,
                course__community=community
            )
        except Exception:
            return error_response("Module introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = CourseModuleCreateUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        updated = ClassroomService.update_module(
            actor_user=request.user,
            module=module,
            data=serializer.validated_data
        )

        return success_response(
            data=CourseModuleSerializer(updated).data,
            message="Module mis à jour avec succès."
        )

    @extend_schema(
        tags=['Classroom'],
        summary="Supprimer un module et ses leçons (Owner ou Admin)",
        responses={200: None}
    )
    def delete(self, request, slug, course_slug, module_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            module = CourseModule.objects.select_related('course__community').get(
                id=module_id,
                course__slug=course_slug,
                course__community=community
            )
        except Exception:
            return error_response("Module introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        ClassroomService.delete_module(request.user, module)
        return success_response(message="Module supprimé avec succès.")
