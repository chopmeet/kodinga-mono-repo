from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.views import APIView

from apps.communities.models.community import Community
from apps.communities.selectors.community_selector import CommunitySelector
from apps.memberships.permissions import (
    check_community_membership,
    check_community_read_permission,
)
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
from common.utils.responses import error_response, success_response


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
        community_slug = request.query_params.get("community")
        order_by = request.query_params.get("order_by", "upvotes")

        if community_slug:
            try:
                community = CommunitySelector.get_community_by_slug(community_slug, user=request.user)
            except Community.DoesNotExist:
                return error_response(
                    "Communauté introuvable.",
                    code="resource_not_found",
                    status_code=status.HTTP_404_NOT_FOUND,
                )
            check_community_read_permission(request.user, community)

        projects = ProjectSelector.list_projects(
            search=search,
            technology_slug=tech,
            community_slug=community_slug,
            order_by=order_by,
            viewer=request.user,
        )
        if request.user.is_authenticated:
            from apps.projects.models.upvote import ProjectUpvote

            upvoted_ids = set(
                ProjectUpvote.objects.filter(
                    user=request.user, project__in=projects
                ).values_list("project_id", flat=True)
            )
            for p in projects:
                p.is_upvoted = p.id in upvoted_ids

        return success_response(data=ProjectSerializer(projects, many=True).data)

    @extend_schema(
        tags=["Hackathons"],
        summary="Publier un projet showcase",
        description="Crée et publie un projet showcase ou projet réalisé lors d'un hackathon.",
        request=CreateProjectSerializer,
        responses={
            201: ProjectDetailSerializer,
            400: OpenApiResponse(description="Erreur de validation"),
            401: OpenApiResponse(description="Authentification requise"),
            403: OpenApiResponse(description="Non autorisé à publier dans cette communauté"),
            404: OpenApiResponse(description="Communauté spécifiée introuvable"),
        },
    )
    def post(self, request):
        if not request.user.is_authenticated:
            return error_response(
                "Authentification requise.",
                code="authentication_required",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = CreateProjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tech_ids = serializer.validated_data.pop("technology_ids", [])
        community_id = serializer.validated_data.pop("community_id", None)
        community = None
        if community_id:
            community = Community.objects.filter(id=community_id).first()
            if not community:
                return error_response(
                    "Communauté introuvable.",
                    code="resource_not_found",
                    status_code=status.HTTP_404_NOT_FOUND,
                )
            check_community_membership(request.user, community, "publier un projet dans cette communauté")

        project = ProjectService.create_project(
            owner=request.user,
            validated_data={**serializer.validated_data, "community": community},
            technology_ids=tech_ids,
        )
        return success_response(
            data=ProjectDetailSerializer(project).data,
            message="Projet publié avec succès.",
            status_code=status.HTTP_201_CREATED,
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
        return success_response(data=ProjectSerializer(projects, many=True).data)


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
            return error_response(
                "Projet introuvable.",
                code="resource_not_found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        if project.community:
            check_community_read_permission(request.user, project.community)
        return success_response(data=ProjectDetailSerializer(project).data)

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
            return error_response(
                "Authentification requise.",
                code="authentication_required",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
        project = Project.objects.filter(slug=slug).first()
        if not project:
            return error_response(
                "Projet introuvable.",
                code="resource_not_found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        if project.community:
            check_community_membership(request.user, project.community, "modifier ce projet")

        serializer = CreateProjectSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        tech_ids = serializer.validated_data.pop("technology_ids", None)
        community_id = serializer.validated_data.pop("community_id", None)
        if community_id is not None:
            community = Community.objects.filter(id=community_id).first()
            if not community:
                return error_response(
                    "Communauté introuvable.",
                    code="resource_not_found",
                    status_code=status.HTTP_404_NOT_FOUND,
                )
            check_community_membership(request.user, community, "associer ce projet à cette communauté")
            serializer.validated_data["community"] = community

        updated_project = ProjectService.update_project(
            project=project,
            user=request.user,
            validated_data=serializer.validated_data,
            technology_ids=tech_ids,
        )
        return success_response(
            data=ProjectDetailSerializer(updated_project).data,
            message="Projet mis à jour avec succès.",
        )

    @extend_schema(
        tags=["Hackathons"],
        summary="Supprimer un projet showcase (Auteur)",
        description="Supprime définitivement un projet showcase.",
        parameters=[
            OpenApiParameter(name="slug", type=str, location=OpenApiParameter.PATH, description="Slug du projet"),
        ],
        responses={
            200: OpenApiResponse(description="Projet supprimé"),
            401: OpenApiResponse(description="Authentification requise"),
            403: OpenApiResponse(description="Non autorisé à supprimer ce projet"),
            404: OpenApiResponse(description="Projet introuvable"),
        },
    )
    def delete(self, request, slug):
        if not request.user.is_authenticated:
            return error_response(
                "Authentification requise.",
                code="authentication_required",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )
        project = Project.objects.filter(slug=slug).first()
        if not project:
            return error_response(
                "Projet introuvable.",
                code="resource_not_found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        if project.community:
            check_community_membership(request.user, project.community, "supprimer ce projet")

        ProjectService.delete_project(project, request.user)
        return success_response(message="Projet supprimé avec succès.")


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
            return error_response(
                "Projet introuvable.",
                code="resource_not_found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        if project.community:
            check_community_read_permission(request.user, project.community)
            check_community_membership(request.user, project.community, "voter pour ce projet")

        is_upvoted, count = ProjectService.toggle_upvote(project, request.user)
        return success_response(data={"is_upvoted": is_upvoted, "upvotes_count": count})


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
            return error_response(
                "Projet introuvable.",
                code="resource_not_found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        if project.community:
            check_community_read_permission(request.user, project.community)

        comments = ProjectSelector.get_project_comments(project)
        return success_response(data=ProjectCommentSerializer(comments, many=True).data)

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
            return error_response(
                "Projet introuvable.",
                code="resource_not_found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        if project.community:
            check_community_read_permission(request.user, project.community)
            check_community_membership(request.user, project.community, "commenter ce projet")

        serializer = CreateProjectCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        comment = ProjectService.add_comment(
            project=project,
            author=request.user,
            content=serializer.validated_data["content"],
            parent_id=serializer.validated_data.get("parent_id"),
        )
        return success_response(
            data=ProjectCommentSerializer(comment).data,
            message="Commentaire publié avec succès.",
            status_code=status.HTTP_201_CREATED,
        )


class ProjectFeatureToggleView(APIView):
    """
    POST /api/v1/projects/<slug>/feature/
    POST /api/v1/communities/<slug>/projects/<project_id>/feature/
    Mettre en avant ou retirer de l'avant-scène un projet showcase (gestionnaires uniquement).
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Hackathons"],
        summary="Mettre en avant ou retirer un projet de la une",
        responses={200: ProjectSerializer},
    )
    def post(self, request, slug=None, project_id=None, community_slug=None):
        from apps.memberships.models.member import CommunityMember, MembershipStatus
        from common.permissions.base import is_superadmin_user

        identifier = project_id or slug
        project = None
        if identifier:
            import uuid
            try:
                uuid.UUID(str(identifier))
                project = Project.objects.filter(id=identifier).first()
            except Exception:
                project = Project.objects.filter(slug=identifier).first()

        if not project:
            return error_response(
                "Projet introuvable.",
                code="resource_not_found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Check manager authorization
        is_authorized = False
        if is_superadmin_user(request.user):
            is_authorized = True
        elif project.community:
            if project.community.owner_id == request.user.id:
                is_authorized = True
            else:
                member = CommunityMember.objects.filter(
                    community=project.community,
                    user=request.user,
                    status=MembershipStatus.ACTIVE
                ).first()
                if member and member.is_admin:
                    is_authorized = True

        if not is_authorized:
            return error_response(
                "Droits administrateur ou propriétaire de la communauté requis pour mettre ce projet en avant.",
                status_code=status.HTTP_403_FORBIDDEN
            )

        if isinstance(request.data, dict) and "is_featured" in request.data:
            project.is_featured = bool(request.data["is_featured"])
        else:
            project.is_featured = not project.is_featured

        project.save(update_fields=["is_featured", "updated_at"])

        msg = "Projet mis en avant avec succès !" if project.is_featured else "Projet retiré de la une."
        return success_response(
            data=ProjectSerializer(project).data,
            message=msg,
        )
