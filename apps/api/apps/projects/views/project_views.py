from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.communities.models.community import Community
from apps.projects.models.project import Project
from apps.projects.selectors.project_selector import ProjectSelector
from apps.projects.serializers.project_serializers import (
    CreateProjectCommentSerializer,
    CreateProjectSerializer,
    ProjectCommentSerializer,
    ProjectDetailSerializer,
    ProjectSerializer,
    ProjectUpvoteResponseSerializer,
)
from apps.projects.services.project_service import ProjectService


class ProjectListView(APIView):
    """
    GET / POST /api/v1/projects/
    Public showcase of tech projects and hackathon creations.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = ProjectSerializer

    @extend_schema(
        tags=["Hackathons"],
        summary="Découverte et recherche des projets showcase",
        description="Liste l'ensemble des projets publics avec filtres par technologie, communauté et tri par popularité ou date.",
        parameters=[
            OpenApiParameter(name="search", type=str, required=False, description="Recherche textuelle dans le titre ou la tagline"),
            OpenApiParameter(name="tech", type=str, required=False, description="Slug de la technologie"),
            OpenApiParameter(name="community", type=str, required=False, description="Slug de la communauté associée"),
            OpenApiParameter(
                name="order_by",
                type=str,
                required=False,
                enum=["upvotes", "views", "newest", "oldest"],
                description="Critère de tri (par défaut: upvotes)",
            ),
        ],
        responses={200: ProjectSerializer(many=True)},
    )
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

    @extend_schema(
        tags=["Hackathons"],
        summary="Publier un projet showcase",
        description="Crée et publie un projet showcase ou projet réalisé lors d'un hackathon.",
        request=CreateProjectSerializer,
        responses={
            201: ProjectDetailSerializer,
            400: OpenApiResponse(description="Erreur de validation"),
            401: OpenApiResponse(description="Authentification requise"),
            404: OpenApiResponse(description="Communauté spécifiée introuvable"),
        },
    )
    def post(self, request):
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentification requise."}, status=status.HTTP_401_UNAUTHORIZED
            )

        serializer = CreateProjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tech_ids = serializer.validated_data.pop("technology_ids", [])
        community_id = serializer.validated_data.pop("community_id", None)
        community = None
        if community_id:
            community = Community.objects.filter(id=community_id).first()
            if not community:
                return Response(
                    {"detail": "Communauté introuvable."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        project = ProjectService.create_project(
            owner=request.user,
            validated_data={**serializer.validated_data, "community": community},
            technology_ids=tech_ids,
        )
        return Response(
            ProjectDetailSerializer(project).data,
            status=status.HTTP_201_CREATED,
        )


class MyProjectListView(APIView):
    """
    GET /api/v1/projects/my/
    List all showcase projects owned by the authenticated user.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProjectSerializer

    @extend_schema(
        tags=["Hackathons"],
        summary="Mes projets showcase",
        description="Liste l'ensemble des projets showcase créés ou publiés par l'utilisateur connecté.",
        responses={200: ProjectSerializer(many=True)},
    )
    def get(self, request):
        projects = ProjectSelector.get_user_projects(request.user)
        return Response(ProjectSerializer(projects, many=True).data)


class ProjectDetailView(APIView):
    """
    GET / PATCH / DELETE /api/v1/projects/<slug>/
    Retrieve, update or delete a showcase project.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = ProjectDetailSerializer

    @extend_schema(
        tags=["Hackathons"],
        summary="Détails d'un projet showcase",
        description="Récupère les informations complètes d'un projet, incluant technologies, auteur, métriques et statut d'upvote.",
        parameters=[
            OpenApiParameter(name="slug", type=str, location=OpenApiParameter.PATH, description="Slug du projet"),
        ],
        responses={
            200: ProjectDetailSerializer,
            404: OpenApiResponse(description="Projet introuvable"),
        },
    )
    def get(self, request, slug):
        project = ProjectSelector.get_project_by_slug(slug, viewer=request.user)
        if not project:
            return Response({"detail": "Projet introuvable."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProjectDetailSerializer(project).data)

    @extend_schema(
        tags=["Hackathons"],
        summary="Modifier un projet showcase (Auteur)",
        description="Met à jour les informations, liens de démo, dépôt GitHub et technologies associées au projet.",
        parameters=[
            OpenApiParameter(name="slug", type=str, location=OpenApiParameter.PATH, description="Slug du projet"),
        ],
        request=CreateProjectSerializer,
        responses={
            200: ProjectDetailSerializer,
            400: OpenApiResponse(description="Erreur de validation"),
            401: OpenApiResponse(description="Authentification requise"),
            403: OpenApiResponse(description="Non autorisé à modifier ce projet"),
            404: OpenApiResponse(description="Projet introuvable"),
        },
    )
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
            if not community:
                return Response(
                    {"detail": "Communauté introuvable."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            serializer.validated_data["community"] = community

        updated_project = ProjectService.update_project(
            project=project,
            user=request.user,
            validated_data=serializer.validated_data,
            technology_ids=tech_ids,
        )
        return Response(ProjectDetailSerializer(updated_project).data)

    @extend_schema(
        tags=["Hackathons"],
        summary="Supprimer un projet showcase (Auteur)",
        description="Supprime définitivement un projet showcase.",
        parameters=[
            OpenApiParameter(name="slug", type=str, location=OpenApiParameter.PATH, description="Slug du projet"),
        ],
        responses={
            204: OpenApiResponse(description="Projet supprimé"),
            401: OpenApiResponse(description="Authentification requise"),
            403: OpenApiResponse(description="Non autorisé à supprimer ce projet"),
            404: OpenApiResponse(description="Projet introuvable"),
        },
    )
    def delete(self, request, slug):
        if not request.user.is_authenticated:
            return Response({"detail": "Non authentifié."}, status=status.HTTP_401_UNAUTHORIZED)
        project = Project.objects.filter(slug=slug).first()
        if not project:
            return Response({"detail": "Projet introuvable."}, status=status.HTTP_404_NOT_FOUND)

        ProjectService.delete_project(project, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectUpvoteView(APIView):
    """
    POST /api/v1/projects/<slug>/upvote/
    Toggle upvote for a showcase project.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProjectUpvoteResponseSerializer

    @extend_schema(
        tags=["Hackathons"],
        summary="Voter / Upvoter un projet showcase",
        description="Alterne l'upvote pour un projet (ajoute ou retire le vote) et renvoie le nouveau compteur.",
        parameters=[
            OpenApiParameter(name="slug", type=str, location=OpenApiParameter.PATH, description="Slug du projet"),
        ],
        responses={
            200: ProjectUpvoteResponseSerializer,
            401: OpenApiResponse(description="Authentification requise"),
            404: OpenApiResponse(description="Projet introuvable"),
        },
    )
    def post(self, request, slug):
        project = Project.objects.filter(slug=slug).first()
        if not project:
            return Response({"detail": "Projet introuvable."}, status=status.HTTP_404_NOT_FOUND)

        is_upvoted, count = ProjectService.toggle_upvote(project, request.user)
        return Response({"is_upvoted": is_upvoted, "upvotes_count": count})


class ProjectCommentListView(APIView):
    """
    GET / POST /api/v1/projects/<slug>/comments/
    List or add comments / feedbacks on a showcase project.
    """

    serializer_class = ProjectCommentSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    @extend_schema(
        tags=["Hackathons"],
        summary="Lister les commentaires d'un projet",
        description="Renvoie la liste hiérarchique des commentaires et réponses laissés sur le projet.",
        parameters=[
            OpenApiParameter(name="slug", type=str, location=OpenApiParameter.PATH, description="Slug du projet"),
        ],
        responses={
            200: ProjectCommentSerializer(many=True),
            404: OpenApiResponse(description="Projet introuvable"),
        },
    )
    def get(self, request, slug):
        project = Project.objects.filter(slug=slug).first()
        if not project:
            return Response({"detail": "Projet introuvable."}, status=status.HTTP_404_NOT_FOUND)

        comments = ProjectSelector.get_project_comments(project)
        return Response(ProjectCommentSerializer(comments, many=True).data)

    @extend_schema(
        tags=["Hackathons"],
        summary="Commenter un projet showcase",
        description="Ajoute un retour, commentaire ou répond à un commentaire existant sur le projet.",
        parameters=[
            OpenApiParameter(name="slug", type=str, location=OpenApiParameter.PATH, description="Slug du projet"),
        ],
        request=CreateProjectCommentSerializer,
        responses={
            201: ProjectCommentSerializer,
            400: OpenApiResponse(description="Erreur de validation"),
            401: OpenApiResponse(description="Authentification requise"),
            404: OpenApiResponse(description="Projet ou commentaire parent introuvable"),
        },
    )
    def post(self, request, slug):
        project = Project.objects.filter(slug=slug).first()
        if not project:
            return Response({"detail": "Projet introuvable."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CreateProjectCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        comment = ProjectService.add_comment(
            project=project,
            author=request.user,
            content=serializer.validated_data["content"],
            parent_id=serializer.validated_data.get("parent_id"),
        )
        return Response(ProjectCommentSerializer(comment).data, status=status.HTTP_201_CREATED)
