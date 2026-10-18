from django.db.models import F, Q
from rest_framework.exceptions import PermissionDenied

from apps.opportunities.models.application import OpportunityApplication
from apps.opportunities.models.opportunity import (
    Opportunity,
    OpportunityStatus,
)
from common.permissions.base import is_superadmin_user


class OpportunitySelector:
    """
    Optimized queries for opportunities and job applications.
    """

    @classmethod
    def list_opportunities(
        cls,
        opportunity_type=None,
        workplace_type=None,
        experience_level=None,
        search=None,
        technology_slug=None,
        community_slug=None,
        status=OpportunityStatus.OPEN,
    ):
        qs = (
            Opportunity.objects.filter(status=status)
            .select_related("poster__profile", "community")
            .prefetch_related("technologies")
        )

        if opportunity_type:
            qs = qs.filter(opportunity_type=opportunity_type)

        if workplace_type:
            qs = qs.filter(workplace_type=workplace_type)

        if experience_level:
            qs = qs.filter(experience_level=experience_level)

        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(company_name__icontains=search)
                | Q(description__icontains=search)
                | Q(location__icontains=search)
            )

        if technology_slug:
            qs = qs.filter(technologies__slug=technology_slug)

        if community_slug:
            qs = qs.filter(community__slug=community_slug)

        return qs.distinct().order_by("-created_at")

    @classmethod
    def get_opportunity_by_slug(cls, slug, viewer=None):
        opportunity = (
            Opportunity.objects.filter(slug=slug)
            .select_related("poster__profile", "community")
            .prefetch_related("technologies")
            .first()
        )
        if not opportunity:
            return None

        # Increment views
        Opportunity.objects.filter(id=opportunity.id).update(views_count=F("views_count") + 1)
        opportunity.refresh_from_db(fields=["views_count"])

        has_applied = False
        if viewer and viewer.is_authenticated:
            has_applied = OpportunityApplication.objects.filter(
                opportunity=opportunity, applicant=viewer
            ).exists()

        opportunity.has_applied = has_applied
        return opportunity

    @classmethod
    def get_user_posted_opportunities(cls, user):
        return (
            Opportunity.objects.filter(poster=user)
            .select_related("community")
            .prefetch_related("technologies")
            .order_by("-created_at")
        )

    @classmethod
    def get_user_applications(cls, user):
        return (
            OpportunityApplication.objects.filter(applicant=user)
            .select_related("opportunity__poster")
            .order_by("-created_at")
        )

    @classmethod
    def get_opportunity_applications(cls, opportunity, user):
        if opportunity.poster_id != user.id and not (user.is_staff or is_superadmin_user(user)):
            raise PermissionDenied("Vous n'êtes pas autorisé à voir ces candidatures.")

        return (
            OpportunityApplication.objects.filter(opportunity=opportunity)
            .select_related("applicant__profile")
            .order_by("-created_at")
        )
