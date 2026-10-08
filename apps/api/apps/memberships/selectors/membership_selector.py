from typing import Optional
from django.db.models import Q, QuerySet
from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.memberships.models.invitation import CommunityInvitation
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)


class MembershipSelector:
    """
    Optimized queries for community members, invitations, and sanctions.
    """

    @classmethod
    def get_member(cls, community: Community, user: User) -> Optional[CommunityMember]:
        if not user or not user.is_authenticated:
            return None
        return CommunityMember.objects.filter(
            community=community,
            user=user
        ).select_related('user', 'user__profile').first()

    @classmethod
    def list_community_members(
        cls,
        community: Community,
        role: str = None,
        status: str = None,
        search: str = None,
    ) -> QuerySet[CommunityMember]:
        qs = CommunityMember.objects.filter(community=community).select_related(
            'user',
            'user__profile'
        )

        if role:
            qs = qs.filter(role=role)

        if status:
            qs = qs.filter(status=status)
        else:
            qs = qs.filter(status=MembershipStatus.ACTIVE)

        if search:
            qs = qs.filter(
                Q(user__username__icontains=search) |
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(custom_title__icontains=search)
            )

        return qs.order_by('-reputation_score', '-joined_at')

    @classmethod
    def get_invitation_by_code(cls, invite_code: str) -> Optional[CommunityInvitation]:
        return CommunityInvitation.objects.filter(
            invite_code=invite_code,
            is_revoked=False
        ).select_related('community', 'invited_by').first()
