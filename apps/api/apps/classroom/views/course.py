from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import success_response, error_response
from apps.communities.selectors.community_selector import CommunitySelector
from apps.classroom.selectors.classroom_selector import ClassroomSelector
from apps.classroom.serializers.course import (
    CourseCreateUpdateSerializer,
    CourseDetailSerializer,
    CourseSerializer,
)
from apps.classroom.serializers.progress import CourseEnrollmentSerializer
from apps.classroom.services.classroom_service import ClassroomService
from apps.classroom.services.progress_service import ProgressService


class CommunityCourseListView(APIView):
    """
    List courses in a community (Active connected members only) or create a new course (Managers only).
    """
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=['Classroom'],
        summary="Lister les cours d'une communauté",
        parameters=[
            OpenApiParameter(name='level', description="Filtrer par niveau (beginner, intermediate, advanced, all_levels)", required=False, type=str),
            OpenApiParameter(name='is_published', description="Filtrer par statut de publication (manager)", required=False, type=bool),
            OpenApiParameter(name='search', description="Recherche par titre ou description", required=False, type=str),
            OpenApiParameter(name='all', description="Retourner la liste complète de tous les cours sans pagination (défaut: false)", required=False, type=bool),
        ],
        responses={200: CourseSerializer(many=True)}
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        level = request.query_params.get('level')
        search = request.query_params.get('search')
        is_published = request.query_params.get('is_published')
        if is_published is not None:
            is_published = is_published.lower() in ['true', '1']

        courses = ClassroomSelector.list_community_courses(
            community=community,
            user=request.user,
            is_published=is_published,
            level=level,
            search=search
        )

        if request.query_params.get('all', '').lower() in ['true', '1']:
            serializer = CourseSerializer(courses, many=True)
            return success_response(data=serializer.data)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(courses, request)
        serializer = CourseSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        tags=['Classroom'],
        summary="Créer un nouveau cours dans la communauté (Owner ou Admin)",
        request=CourseCreateUpdateSerializer,
        responses={201: CourseSerializer}
    )
    def post(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = CourseCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        course = ClassroomService.create_course(
            actor_user=request.user,
            community=community,
            data=serializer.validated_data
        )

        return success_response(
            data=CourseSerializer(course).data,
            message="Cours créé avec succès.",
            status_code=status.HTTP_201_CREATED
        )


class CommunityCourseDetailView(APIView):
    """
    Retrieve course details with modules & lessons (Active connected members only), or update/delete course.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Classroom'],
        summary="Détails d'un cours avec modules et leçons séquentielles",
        responses={200: CourseDetailSerializer}
    )
    def get(self, request, slug, course_slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        course = ClassroomSelector.get_course_by_slug(community, course_slug, user=request.user)
        return success_response(data=CourseDetailSerializer(course).data)

    @extend_schema(
        tags=['Classroom'],
        summary="Modifier un cours (Owner ou Admin)",
        request=CourseCreateUpdateSerializer,
        responses={200: CourseSerializer}
    )
    def patch(self, request, slug, course_slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        course = ClassroomSelector.get_course_by_slug(community, course_slug, user=request.user)

        serializer = CourseCreateUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        updated = ClassroomService.update_course(
            actor_user=request.user,
            course=course,
            data=serializer.validated_data
        )
        return success_response(
            data=CourseSerializer(updated).data,
            message="Cours mis à jour avec succès."
        )

    @extend_schema(
        tags=['Classroom'],
        summary="Supprimer un cours (Owner ou Admin)",
        responses={200: None}
    )
    def delete(self, request, slug, course_slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        course = ClassroomSelector.get_course_by_slug(community, course_slug, user=request.user)
        ClassroomService.delete_course(request.user, course)
        return success_response(message="Cours supprimé avec succès.")


class CourseEnrollView(APIView):
    """
    Enroll into a course to track progress.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Classroom'],
        summary="S'inscrire à un cours de formation",
        request=None,
        responses={200: CourseEnrollmentSerializer}
    )
    def post(self, request, slug, course_slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        course = ClassroomSelector.get_course_by_slug(community, course_slug, user=request.user)
        enrollment = ProgressService.enroll_user(request.user, course)
        return success_response(
            data=CourseEnrollmentSerializer(enrollment).data,
            message=f"Inscription au cours '{course.title}' validée."
        )
