import secrets
from datetime import timedelta
from typing import Optional

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.memberships.models.invitation import CommunityInvitation
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.memberships.models.sanction import MemberSanction, SanctionType
from common.permissions.base import is_superadmin_user


class MembershipService:
    """
    Handles member joins, invitations, role promotions, moderation sanctions, and departures.
    """

    @classmethod
    def join_community(
        cls,
        user: User,
        community: Community,
        invite_code: Optional[str] = None
    ) -> CommunityMember:
        """
        Processes a member joining a community directly, via invitation, or requesting access.
        """
        # Check if already a member
        existing = CommunityMember.objects.filter(community=community, user=user).first()
        if existing:
            if existing.status == MembershipStatus.ACTIVE:
                return existing
            if existing.status == MembershipStatus.BANNED:
                raise PermissionDenied("Vous êtes banni de cette communauté.")
            if existing.status == MembershipStatus.PENDING:
                raise ValidationError("Votre demande d'adhésion est en cours d'examen.")

        initial_role = CommunityRole.MEMBER
        initial_status = MembershipStatus.ACTIVE

        # Validate invitation if provided
        invitation = None
        if invite_code:
            invitation = CommunityInvitation.objects.filter(
                invite_code=invite_code,
                community=community
            ).first()
            if not invitation or not invitation.is_valid:
                raise ValidationError("Ce lien d'invitation est invalide ou a expiré.")
            initial_role = invitation.role

        # Check paid community restriction: direct free join is blocked (superadmins bypass)
        if community.pricing_type == 'paid' and not invite_code and not is_superadmin_user(user) and user.id != community.owner_id:
            from django.utils import timezone

            from apps.billing.models.subscription import (
                Subscription,
                SubscriptionStatus,
            )
            has_valid_sub = Subscription.objects.filter(
                user=user,
                community=community,
                status=SubscriptionStatus.ACTIVE,
                current_period_end__gt=timezone.now()
            ).exists()
            if not has_valid_sub:
                raise PermissionDenied(
                    "Cette communauté est payante. Vous devez souscrire à un abonnement (mensuel ou définitif) pour y adhérer."
                )

        # Check approval setting if no invite (superadmin is instantly active)
        elif hasattr(community, 'settings') and community.settings.require_approval_to_join and not is_superadmin_user(user):
            initial_status = MembershipStatus.PENDING

        with transaction.atomic():
            if existing:
                existing.status = initial_status
                existing.role = initial_role
                existing.save(update_fields=['status', 'role', 'updated_at'])
                member = existing
            else:
                member = CommunityMember.objects.create(
                    community=community,
                    user=user,
                    role=initial_role,
                    status=initial_status
                )

            if invitation:
                CommunityInvitation.objects.filter(id=invitation.id).update(
                    uses_count=F('uses_count') + 1
                )

            if initial_status == MembershipStatus.ACTIVE:
                Community.objects.filter(id=community.id).update(
                    members_count=F('members_count') + 1
                )

            return member

    @classmethod
    def leave_community(cls, user: User, community: Community) -> None:
        member = CommunityMember.objects.filter(community=community, user=user).first()
        if not member:
            raise NotFound("Vous n'êtes pas membre de cette communauté.")

        if member.role == CommunityRole.OWNER:
            raise ValidationError("Le propriétaire ne peut pas quitter sa communauté sans transférer la propriété.")

        with transaction.atomic():
            member.status = MembershipStatus.LEFT
            member.save(update_fields=['status', 'updated_at'])
            Community.objects.filter(id=community.id, members_count__gt=0).update(
                members_count=F('members_count') - 1
            )

    @classmethod
    def change_member_role(
        cls,
        actor_user: User,
        member: CommunityMember,
        new_role: str
    ) -> CommunityMember:
        if new_role not in dict(CommunityRole.choices):
            raise ValidationError("Rôle invalide.")

        # Permissions: actor must be Owner or Admin
        actor_membership = CommunityMember.objects.filter(
            community=member.community,
            user=actor_user,
            status=MembershipStatus.ACTIVE
        ).first()

        if not is_superadmin_user(actor_user):
            if not actor_membership or actor_membership.role not in [CommunityRole.OWNER, CommunityRole.ADMIN]:
                raise PermissionDenied("Droits administrateur requis.")

            if member.role == CommunityRole.OWNER and new_role != CommunityRole.OWNER:
                raise PermissionDenied("Le rôle du propriétaire ne peut pas être modifié ainsi.")

            if new_role == CommunityRole.OWNER and actor_membership.role != CommunityRole.OWNER:
                raise PermissionDenied("Seul le propriétaire actuel peut transférer la propriété.")

        with transaction.atomic():
            if new_role == CommunityRole.OWNER:
                # Ownership transfer
                CommunityMember.objects.filter(
                    community=member.community,
                    role=CommunityRole.OWNER
                ).update(role=CommunityRole.ADMIN)

                Community.objects.filter(id=member.community_id).update(owner=member.user)

            member.role = new_role
            member.save(update_fields=['role', 'updated_at'])
            return member

    @classmethod
    def approve_or_reject_member(
        cls,
        actor_user: User,
        member: CommunityMember,
        approve: bool
    ) -> CommunityMember:
        actor_membership = CommunityMember.objects.filter(
            community=member.community,
            user=actor_user,
            status=MembershipStatus.ACTIVE
        ).first()

        if not is_superadmin_user(actor_user) and (not actor_membership or not actor_membership.is_moderator):
            raise PermissionDenied("Droits de modération requis.")

        with transaction.atomic():
            if approve:
                member.status = MembershipStatus.ACTIVE
                member.save(update_fields=['status', 'updated_at'])
                Community.objects.filter(id=member.community_id).update(
                    members_count=F('members_count') + 1
                )
            else:
                member.status = MembershipStatus.REJECTED
                member.save(update_fields=['status', 'updated_at'])

            return member

    @classmethod
    def sanction_member(
        cls,
        actor_user: User,
        member: CommunityMember,
        sanction_type: str,
        reason: str,
        duration_days: Optional[int] = None
    ) -> MemberSanction:
        if sanction_type not in dict(SanctionType.choices):
            raise ValidationError("Type de sanction invalide.")

        actor_membership = CommunityMember.objects.filter(
            community=member.community,
            user=actor_user,
            status=MembershipStatus.ACTIVE
        ).first()

        if not is_superadmin_user(actor_user) and (not actor_membership or not actor_membership.is_moderator):
            raise PermissionDenied("Droits de modération requis.")

        if member.role == CommunityRole.OWNER and not is_superadmin_user(actor_user):
            raise PermissionDenied("Impossible de sanctionner le propriétaire de la communauté.")

        if (
            member.role == CommunityRole.ADMIN
            and not is_superadmin_user(actor_user)
            and actor_membership.role != CommunityRole.OWNER
        ):
            raise PermissionDenied("Seul le propriétaire de la communauté peut sanctionner un administrateur.")

        expires_at = timezone.now() + timedelta(days=duration_days) if duration_days else None

        with transaction.atomic():
            sanction = MemberSanction.objects.create(
                community=member.community,
                member=member,
                sanction_type=sanction_type,
                reason=reason,
                issued_by=actor_user,
                expires_at=expires_at
            )

            if sanction_type == SanctionType.BAN:
                member.status = MembershipStatus.BANNED
                member.save(update_fields=['status', 'updated_at'])
                Community.objects.filter(id=member.community_id, members_count__gt=0).update(
                    members_count=F('members_count') - 1
                )
            elif sanction_type == SanctionType.SUSPENSION:
                member.status = MembershipStatus.SUSPENDED
                member.save(update_fields=['status', 'updated_at'])

            return sanction

    @classmethod
    def create_invitation(
        cls,
        actor_user: User,
        community: Community,
        email: str = "",
        role: str = CommunityRole.MEMBER,
        max_uses: int = 1,
        expires_in_days: int = 7
    ) -> CommunityInvitation:
        actor_membership = CommunityMember.objects.filter(
            community=community,
            user=actor_user,
            status=MembershipStatus.ACTIVE
        ).first()

        if not is_superadmin_user(actor_user):
            if not actor_membership:
                raise PermissionDenied("Vous n'êtes pas membre de cette communauté.")
            if not actor_membership.is_admin and not getattr(community.settings, 'allow_member_invites', True):
                raise PermissionDenied("Les invitations par les membres sont désactivées.")

        invite_code = secrets.token_urlsafe(24)
        expires_at = timezone.now() + timedelta(days=expires_in_days)

        return CommunityInvitation.objects.create(
            community=community,
            invited_by=actor_user,
            email=email,
            invite_code=invite_code,
            role=role,
            max_uses=max_uses,
            expires_at=expires_at
        )
