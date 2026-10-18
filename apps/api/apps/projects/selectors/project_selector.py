from django.db.models import F, Q

from apps.projects.models.comment import ProjectComment
from apps.projects.models.project import Project, ProjectStatus
from apps.projects.models.upvote import ProjectUpvote


class ProjectSelector:
    """
    Optimized queries for projects and portfolio showcases.
    """

    @classmethod
    def list_projects(
        cls,
        search=None,
        technology_slug=None,
        community_slug=None,
        order_by="upvotes",
        status=ProjectStatus.PUBLISHED,
    ):
        qs = (
            Project.objects.filter(status=status)
            .select_related("owner__profile", "community")
            .prefetch_related("technologies")
        )

        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(tagline__icontains=search)
                | Q(description__icontains=search)
            )

        if technology_slug:
            qs = qs.filter(technologies__slug=technology_slug)

        if community_slug:
            qs = qs.filter(community__slug=community_slug)

        if order_by == "recent":
            qs = qs.order_by("-created_at")
        elif order_by == "views":
            qs = qs.order_by("-views_count", "-upvotes_count")
        else:
            qs = qs.order_by("-upvotes_count", "-created_at")

        return qs.distinct()

    @classmethod
    def get_project_by_slug(cls, slug, viewer=None):
        project = (
            Project.objects.filter(slug=slug)
            .select_related("owner__profile", "community")
            .prefetch_related("technologies")
            .first()
        )
        if not project:
            return None

        # Increment view count
        Project.objects.filter(id=project.id).update(views_count=F("views_count") + 1)
        project.refresh_from_db(fields=["views_count"])

        is_upvoted = False
        if viewer and viewer.is_authenticated:
            is_upvoted = ProjectUpvote.objects.filter(project=project, user=viewer).exists()

        project.is_upvoted = is_upvoted
        return project

    @classmethod
    def get_user_projects(cls, user):
        return (
            Project.objects.filter(owner=user)
            .select_related("community")
            .prefetch_related("technologies")
            .order_by("-created_at")
        )

    @classmethod
    def get_project_comments(cls, project):
        return (
            ProjectComment.objects.filter(project=project, parent__isnull=True)
            .select_related("author__profile")
            .prefetch_related("replies__author__profile")
            .order_by("created_at")
        )
