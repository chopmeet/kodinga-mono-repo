from django.db.models import F, Q

from apps.communities.models.community import CommunityPricing, CommunityPrivacy
from apps.memberships.models.member import MembershipStatus
from apps.projects.models.comment import ProjectComment
from apps.projects.models.project import Project, ProjectStatus
from apps.projects.models.upvote import ProjectUpvote
from common.permissions.base import is_superadmin_user


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
        viewer=None,
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
        else:
            # Privacy isolation for public feed:
            # Exclude projects belonging to private, secret, or paid communities
            # unless the viewer has permission (owner, active member, or superadmin).
            if viewer and viewer.is_authenticated:
                if not (viewer.is_staff or is_superadmin_user(viewer)):
                    qs = qs.filter(
                        Q(community__isnull=True)
                        | Q(
                            community__privacy_type=CommunityPrivacy.PUBLIC,
                            community__pricing_type=CommunityPricing.FREE,
                        )
                        | Q(
                            community__memberships__user=viewer,
                            community__memberships__status=MembershipStatus.ACTIVE,
                        )
                        | Q(community__owner=viewer)
                    )
            else:
                qs = qs.filter(
                    Q(community__isnull=True)
                    | Q(
                        community__privacy_type=CommunityPrivacy.PUBLIC,
                        community__pricing_type=CommunityPricing.FREE,
                    )
                )

        if order_by in ("recent", "newest"):
            qs = qs.order_by("-created_at")
        elif order_by == "views":
            qs = qs.order_by("-views_count", "-upvotes_count")
        elif order_by == "upvotes":
            qs = qs.order_by("-upvotes_count", "-created_at")
        elif order_by == "oldest":
            qs = qs.order_by("created_at")
        else:
            qs = qs.order_by("-created_at")

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
        from django.db.models import Prefetch

        replies_prefetch = Prefetch(
            "replies",
            queryset=ProjectComment.objects.select_related("author__profile").order_by("-created_at"),
        )
        return (
            ProjectComment.objects.filter(project=project, parent__isnull=True)
            .select_related("author__profile")
            .prefetch_related(replies_prefetch)
            .order_by("-created_at")
        )
