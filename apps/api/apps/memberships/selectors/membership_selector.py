from typing import Optional

from django.db.models import Q, QuerySet

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.memberships.models.invitation import CommunityInvitation
from apps.memberships.models.member import (
    CommunityMember,
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
        is_manager: bool = False,
        ordering: str = None,
    ) -> QuerySet[CommunityMember]:
        qs = CommunityMember.objects.filter(community=community).select_related(
            'user',
            'user__profile'
        )

        if role:
            qs = qs.filter(role=role)

        if not is_manager:
            qs = qs.filter(status=MembershipStatus.ACTIVE)
        elif status and status.lower() != 'all':
            qs = qs.filter(status=status)

        if search:
            q_filter = (
                Q(user__username__icontains=search) |
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(custom_title__icontains=search)
            )
            if is_manager:
                q_filter = q_filter | Q(user__email__icontains=search)
            qs = qs.filter(q_filter)

        allowed_orderings = {
            'joined_at': 'joined_at',
            '-joined_at': '-joined_at',
            'reputation': '-reputation_score',
            '-reputation': 'reputation_score',
            'points': '-reputation_score',
            '-points': 'reputation_score',
            'reputation_score': '-reputation_score',
            '-reputation_score': '-reputation_score',
            'username': 'user__username',
            '-username': '-user__username',
            'role': 'role',
            '-role': '-role',
        }
        if ordering and ordering in allowed_orderings:
            return qs.order_by(allowed_orderings[ordering], '-joined_at')

        return qs.order_by('-reputation_score', '-joined_at')

    @classmethod
    def get_invitation_by_code(cls, invite_code: str) -> Optional[CommunityInvitation]:
        from apps.memberships.models.invitation import InvitationStatus
        from common.utils.tokens import hash_token
        token_hash = hash_token(invite_code.strip())
        return CommunityInvitation.objects.filter(
            status=InvitationStatus.PENDING
        ).filter(
            Q(token_hash=token_hash) | Q(invite_code=invite_code)
        ).select_related('community', 'invited_by').first()
