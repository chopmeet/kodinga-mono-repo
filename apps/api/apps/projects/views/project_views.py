from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.communities.models.community import Community
from apps.projects.models.project import Project
from apps.projects.selectors.project_selector import ProjectSelector
from apps.projects.serializers.project_serializers import (
    CreateProjectSerializer,
    ProjectCommentSerializer,
    ProjectDetailSerializer,
    ProjectSerializer,
)
from apps.projects.services.project_service import ProjectService


@extend_schema(tags=["Projects"])
class ProjectListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        search = request.query_params.get("search")
        tech = request.query_params.get("tech")
        community = request.query_params.get("community")
        order_by = request.query_params.get("order_by", "upvotes")

        projects = ProjectSelector.list_projects(
            search=search,
            technology_slug=tech,
            community_slug=community,
            order_by=order_by,
        )
        # annotate upvoted status if user authenticated
        if request.user.is_authenticated:
            from apps.projects.models.upvote import ProjectUpvote
            upvoted_ids = set(
                ProjectUpvote.objects.filter(
                    user=request.user, project__in=projects
                ).values_list("project_id", flat=True)
            )
            for p in projects:
                setattr(p, "is_upvoted", p.id in upvoted_ids)

        return Response(ProjectSerializer(projects, many=True).data)

    def post(self, request):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentification requise."}, status=status.HTTP_401_UNAUTHORIZED
            )

        serializer = CreateProjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tech_ids = serializer.validated_data.pop("technology_ids", [])
        community_id = serializer.validated_data.pop("community_id", None)
        community = Community.objects.filter(id=community_id).first() if community_id else None

        project = ProjectService.create_project(
            owner=request.user,
            validated_data={**serializer.validated_data, "community": community},
            technology_ids=tech_ids,
        )
        return Response(
            ProjectDetailSerializer(project).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["Projects"])
class MyProjectListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        projects = ProjectSelector.get_user_projects(request.user)
        return Response(ProjectSerializer(projects, many=True).data)


@extend_schema(tags=["Projects"])
class ProjectDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        project = ProjectSelector.get_project_by_slug(slug, viewer=request.user)
        if not project:
            return Response({"detail": "Projet introuvable."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProjectDetailSerializer(project).data)

    def patch(self, request, slug):
        if not request.user.is_authenticated:
            return Response({"detail": "Non authentifié."}, status=status.HTTP_401_UNAUTHORIZED)
        project = Project.objects.filter(slug=slug).first()
        if not project:
            return Response({"detail": "Projet introuvable."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CreateProjectSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        tech_ids = serializer.validated_data.pop("technology_ids", None)
        community_id = serializer.validated_data.pop("community_id", None)
        if community_id is not None:
            community = Community.objects.filter(id=community_id).first()
            serializer.validated_data["community"] = community

        updated_project = ProjectService.update_project(
            project=project,
            user=request.user,
            validated_data=serializer.validated_data,
            technology_ids=tech_ids,
        )
        return Response(ProjectDetailSerializer(updated_project).data)

    def delete(self, request, slug):
        if not request.user.is_authenticated:
            return Response({"detail": "Non authentifié."}, status=status.HTTP_401_UNAUTHORIZED)
        project = Project.objects.filter(slug=slug).first()
        if not project:
            return Response({"detail": "Projet introuvable."}, status=status.HTTP_404_NOT_FOUND)

        ProjectService.delete_project(project, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Projects"])
class ProjectUpvoteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        project = Project.objects.filter(slug=slug).first()
        if not project:
            return Response({"detail": "Projet introuvable."}, status=status.HTTP_404_NOT_FOUND)

        is_upvoted, count = ProjectService.toggle_upvote(project, request.user)
        return Response({"is_upvoted": is_upvoted, "upvotes_count": count})


@extend_schema(tags=["Projects"])
class ProjectCommentListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        project = Project.objects.filter(slug=slug).first()
        if not project:
            return Response({"detail": "Projet introuvable."}, status=status.HTTP_404_NOT_FOUND)

        comments = ProjectSelector.get_project_comments(project)
        return Response(ProjectCommentSerializer(comments, many=True).data)

    def post(self, request, slug):
        if not request.user.is_authenticated:
            return Response({"detail": "Non authentifié."}, status=status.HTTP_401_UNAUTHORIZED)

        project = Project.objects.filter(slug=slug).first()
        if not project:
            return Response({"detail": "Projet introuvable."}, status=status.HTTP_404_NOT_FOUND)

        content = request.data.get("content", "").strip()
        parent_id = request.data.get("parent_id")

        comment = ProjectService.add_comment(
            project=project,
            author=request.user,
            content=content,
            parent_id=parent_id,
        )
        return Response(ProjectCommentSerializer(comment).data, status=status.HTTP_201_CREATED)
