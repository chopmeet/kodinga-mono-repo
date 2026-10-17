from typing import Optional

from django.db.models import Q, QuerySet
from rest_framework.exceptions import NotFound, PermissionDenied

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.hackathons.models.application import HackathonApplication
from apps.hackathons.models.hackathon import Hackathon, HackathonStatus
from apps.hackathons.models.judge import HackathonJudge
from apps.hackathons.models.submission import HackathonSubmission
from apps.hackathons.models.team import HackathonTeam, TeamInvitationStatus
from common.permissions.base import is_superadmin_user


class HackathonSelector:
    """
    Optimized queries for retrieving hackathons, applications, teams,
    submissions, and judging leaderboards.
    """

    @classmethod
    def is_community_manager(cls, user: Optional[User], community: Community) -> bool:
        if not user or not user.is_authenticated:
            return False
        if is_superadmin_user(user) or community.owner_id == user.id:
            return True
        from apps.memberships.models.member import (
            CommunityMember,
            CommunityRole,
            MembershipStatus,
        )

        return CommunityMember.objects.filter(
            community=community,
            user=user,
            status=MembershipStatus.ACTIVE,
            role__in=[CommunityRole.OWNER, CommunityRole.ADMIN],
        ).exists()

    @classmethod
    def is_hackathon_judge(cls, user: Optional[User], hackathon: Hackathon) -> bool:
        if not user or not user.is_authenticated:
            return False
        if cls.is_community_manager(user, hackathon.community):
            return True
        return HackathonJudge.objects.filter(
            hackathon=hackathon, user=user
        ).exists()

    @classmethod
    def get_public_hackathons(
        cls,
        search: Optional[str] = None,
        format_type: Optional[str] = None,
        theme: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> QuerySet[Hackathon]:
        qs = (
            Hackathon.objects.exclude(status=HackathonStatus.DRAFT)
            .select_related("community", "organizer")
            .prefetch_related("technologies", "prizes")
        )

        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(tagline__icontains=search)
                | Q(description__icontains=search)
                | Q(theme__icontains=search)
            )
        if format_type:
            qs = qs.filter(format=format_type)
        if theme:
            qs = qs.filter(theme__icontains=theme)
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs.order_by("-start_time")

    @classmethod
    def get_community_hackathons(
        cls,
        community: Community,
        user: Optional[User] = None,
        status_filter: Optional[str] = None,
    ) -> QuerySet[Hackathon]:
        is_mgr = cls.is_community_manager(user, community)
        qs = Hackathon.objects.filter(community=community).select_related(
            "community", "organizer"
        ).prefetch_related("technologies", "prizes")

        if not is_mgr:
            qs = qs.exclude(status=HackathonStatus.DRAFT)

        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs.order_by("-start_time")

    @classmethod
    def get_hackathon_by_slug(
        cls,
        community_slug: str,
        hackathon_slug: str,
        user: Optional[User] = None,
    ) -> Hackathon:
        hackathon = (
            Hackathon.objects.filter(
                community__slug=community_slug, slug=hackathon_slug
            )
            .select_related("community", "organizer")
            .prefetch_related(
                "technologies",
                "prizes",
                "criteria",
                "judge_assignments__user",
            )
            .first()
        )

        if not hackathon:
            raise NotFound("Hackathon introuvable dans cette communauté.")

        if hackathon.status == HackathonStatus.DRAFT and not cls.is_community_manager(user, hackathon.community):
            raise PermissionDenied(
                "Ce hackathon est encore au stade de brouillon."
            )

        return hackathon

    @classmethod
    def get_user_application(
        cls, hackathon: Hackathon, user: User
    ) -> Optional[HackathonApplication]:
        if not user or not user.is_authenticated:
            return None
        return HackathonApplication.objects.filter(
            hackathon=hackathon, applicant=user
        ).first()

    @classmethod
    def get_user_team(
        cls, hackathon: Hackathon, user: User
    ) -> Optional[HackathonTeam]:
        if not user or not user.is_authenticated:
            return None
        # Leader of team
        leader_team = HackathonTeam.objects.filter(
            hackathon=hackathon, leader=user
        ).first()
        if leader_team:
            return leader_team

        # Accepted member of team
        member_record = (
            user.hackathon_team_memberships.filter(
                team__hackathon=hackathon,
                status=TeamInvitationStatus.ACCEPTED,
            )
            .select_related("team")
            .first()
        )
        return member_record.team if member_record else None

    @classmethod
    def get_user_submission(
        cls, hackathon: Hackathon, user: User
    ) -> Optional[HackathonSubmission]:
        if not user or not user.is_authenticated:
            return None

        # Check team submission first
        user_team = cls.get_user_team(hackathon, user)
        if user_team:
            team_sub = HackathonSubmission.objects.filter(
                hackathon=hackathon, team=user_team
            ).prefetch_related("files", "technologies").first()
            if team_sub:
                return team_sub

        # Direct individual submission
        return HackathonSubmission.objects.filter(
            hackathon=hackathon, applicant=user, team__isnull=True
        ).prefetch_related("files", "technologies").first()

    @classmethod
    def get_hackathon_leaderboard(
        cls, hackathon: Hackathon, user: Optional[User] = None
    ) -> QuerySet[HackathonSubmission]:
        is_mgr = cls.is_community_manager(user, hackathon.community)
        is_judge = cls.is_hackathon_judge(user, hackathon)

        # Non-managers and non-judges can only view leaderboard if results are published
        if not (is_mgr or is_judge) and not hackathon.results_published:
            raise PermissionDenied(
                "Les résultats officiels de ce hackathon ne sont pas encore publiés."
            )

        return (
            HackathonSubmission.objects.filter(
                hackathon=hackathon, is_final=True
            )
            .select_related("team", "applicant")
            .prefetch_related("won_prizes", "technologies")
            .order_by("-total_score", "submitted_at")
        )
