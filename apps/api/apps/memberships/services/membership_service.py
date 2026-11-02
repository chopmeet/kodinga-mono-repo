import secrets
from datetime import timedelta
from typing import Optional

from django.db import models, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.accounts.models.user import User
from apps.communities.models.community import Community, CommunityPrivacy
from apps.memberships.models.invitation import (
    CommunityInvitation,
    InvitationStatus,
)
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.memberships.models.sanction import MemberSanction, SanctionType
from apps.memberships.permissions import (
    check_last_admin_protection,
    has_community_permission,
    is_superadmin_user,
)
from apps.notifications.models.notification import NotificationType
from apps.notifications.services.notification_service import NotificationService
from common.exceptions.handler import ConflictError
from common.utils.tokens import hash_token


class MembershipService:
    """
    Handles member joins, invitations, role promotions, moderation sanctions, and departures.
    """

    @classmethod
    def _get_join_request_reviewers(cls, community: Community, exclude_user: Optional[User] = None) -> list[User]:
        """
        Returns all users authorized to review join requests for the community:
        - The community owner
        - Active members whose role or user override grants `can_review_requests`
        """
        recipients_by_id: dict[str, User] = {}
        if (
            community.owner_id
            and (not exclude_user or community.owner_id != exclude_user.id)
            and community.owner
            and community.owner.is_active
        ):
            recipients_by_id[str(community.owner_id)] = community.owner

        active_members = CommunityMember.objects.filter(
            community=community,
            status=MembershipStatus.ACTIVE,
            user__is_active=True,
        ).select_related('user')

        for m in active_members:
            if exclude_user and m.user_id == exclude_user.id:
                continue
            if str(m.user_id) in recipients_by_id:
                continue
            if has_community_permission(m.user, community, 'can_review_requests'):
                recipients_by_id[str(m.user_id)] = m.user

        return list(recipients_by_id.values())

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

        is_owner = community.owner_id == user.id
        initial_role = CommunityRole.OWNER if is_owner else CommunityRole.MEMBER
        initial_status = MembershipStatus.ACTIVE

        # Validate invitation if provided
        invitation = None
        if invite_code:
            code_hash = hash_token(invite_code.strip())
            invitation = CommunityInvitation.objects.filter(
                community=community
            ).filter(
                models.Q(token_hash=code_hash) | models.Q(invite_code=invite_code.strip())
            ).first()
            if not invitation or not invitation.is_valid:
                raise ValidationError("Ce lien d'invitation est invalide ou a expiré.")

            # Email match verification
            if invitation.email and user.email.strip().lower() != invitation.email.strip().lower():
                raise PermissionDenied("Cette invitation a été envoyée à une autre adresse email.")

            if not is_owner:
                initial_role = invitation.role

        # Check paid community restriction: direct free join is blocked (superadmins and owners bypass)
        if community.pricing_type == 'paid' and not invite_code and not is_superadmin_user(user) and not is_owner:
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

        # Check approval setting or private community if no invite (superadmin and owner are instantly active)
        elif (
            not invite_code
            and not is_superadmin_user(user)
            and not is_owner
            and (
                (hasattr(community, 'settings') and community.settings.require_approval_to_join)
                or community.privacy_type == CommunityPrivacy.PRIVATE
            )
        ):
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
                new_uses = (invitation.uses_count or 0) + 1
                update_kwargs = {'uses_count': F('uses_count') + 1}
                if not invitation.max_uses or new_uses >= invitation.max_uses or invitation.email:
                    update_kwargs['status'] = InvitationStatus.ACCEPTED
                    update_kwargs['accepted_at'] = timezone.now()
                CommunityInvitation.objects.filter(id=invitation.id).update(**update_kwargs)

            if initial_status == MembershipStatus.ACTIVE:
                Community.objects.filter(id=community.id).update(
                    members_count=F('members_count') + 1
                )

        # Dispatch notifications outside transaction
        user_display = user.get_full_name() or user.username
        if initial_status == MembershipStatus.PENDING:
            reviewers = cls._get_join_request_reviewers(community, exclude_user=user)
            for reviewer in reviewers:
                NotificationService.create_notification(
                    recipient=reviewer,
                    actor=user,
                    title=f"Nouvelle demande d'adhésion : {community.name}",
                    body=f"{user_display} demande à rejoindre la communauté {community.name}.",
                    notification_type=NotificationType.JOIN_REQUEST,
                    action_url=f"/communities/{community.slug}/members?status=pending",
                    target_type="community_member",
                    target_id=str(member.id),
                    metadata={
                        "community_id": str(community.id),
                        "community_slug": community.slug,
                        "community_name": community.name,
                        "member_id": str(member.id),
                        "requester_id": str(user.id),
                        "requester_username": user.username,
                        "event": "join_request_created",
                    },
                )
        elif invitation and invitation.invited_by and invitation.invited_by_id != user.id:
            NotificationService.create_notification(
                recipient=invitation.invited_by,
                actor=user,
                title=f"Invitation acceptée : {user_display}",
                body=f"{user_display} a rejoint la communauté {community.name} via votre invitation.",
                notification_type=NotificationType.COMMUNITY_INVITE,
                action_url=f"/communities/{community.slug}/members",
                target_type="community_member",
                target_id=str(member.id),
                metadata={
                    "community_id": str(community.id),
                    "community_slug": community.slug,
                    "invitation_id": str(invitation.id),
                    "status": InvitationStatus.ACCEPTED,
                },
            )

        return member

    @classmethod
    def leave_community(cls, user: User, community: Community) -> None:
        member = CommunityMember.objects.filter(community=community, user=user).first()
        if not member:
            raise NotFound("Vous n'êtes pas membre de cette communauté.")

        if member.role == CommunityRole.OWNER:
            raise ValidationError("Le propriétaire ne peut pas quitter sa communauté sans transférer la propriété.")

        # Last admin protection
        check_last_admin_protection(community, user.id)

        with transaction.atomic():
            was_active = member.status == MembershipStatus.ACTIVE
            member.status = MembershipStatus.LEFT
            member.save(update_fields=['status', 'updated_at'])
            if was_active:
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

        is_owner_actor = member.community.owner_id == actor_user.id or (
            actor_membership and actor_membership.role == CommunityRole.OWNER
        )
        is_admin_actor = is_owner_actor or (
            actor_membership and actor_membership.role in [CommunityRole.OWNER, CommunityRole.ADMIN]
        )

        if not is_superadmin_user(actor_user):
            if not is_admin_actor:
                raise PermissionDenied("Droits administrateur requis.")

            if member.role == CommunityRole.OWNER and new_role != CommunityRole.OWNER:
                raise PermissionDenied("Le rôle du propriétaire ne peut pas être modifié ainsi.")

            if new_role == CommunityRole.OWNER and not is_owner_actor:
                raise PermissionDenied("Seul le propriétaire actuel peut transférer la propriété.")

        # Check last admin protection if demoting from admin/owner to non-admin
        if member.role in [CommunityRole.OWNER, CommunityRole.ADMIN] and new_role not in [CommunityRole.OWNER, CommunityRole.ADMIN]:
            check_last_admin_protection(member.community, member.user_id)

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
        community = member.community
        actor_membership = CommunityMember.objects.filter(
            community=community,
            user=actor_user,
            status=MembershipStatus.ACTIVE
        ).first()

        can_review = (
            is_superadmin_user(actor_user)
            or community.owner_id == actor_user.id
            or (actor_membership and actor_membership.is_moderator)
            or has_community_permission(actor_user, community, 'can_review_requests')
        )
        if not can_review:
            raise PermissionDenied("Droits de modération requis.")

        previous_status = member.status

        with transaction.atomic():
            if approve:
                member.status = MembershipStatus.ACTIVE
                member.save(update_fields=['status', 'updated_at'])
                if previous_status != MembershipStatus.ACTIVE:
                    Community.objects.filter(id=member.community_id).update(
                        members_count=F('members_count') + 1
                    )
            else:
                member.status = MembershipStatus.REJECTED
                member.save(update_fields=['status', 'updated_at'])
                if previous_status == MembershipStatus.ACTIVE:
                    Community.objects.filter(id=member.community_id, members_count__gt=0).update(
                        members_count=F('members_count') - 1
                    )

        # Notify the applicant of the decision (BE-02)
        if approve:
            NotificationService.create_notification(
                recipient=member.user,
                actor=actor_user,
                title=f"Demande d'adhésion acceptée : {community.name}",
                body=f"Félicitations ! Votre demande d'adhésion à la communauté {community.name} a été acceptée.",
                notification_type=NotificationType.JOIN_REQUEST_APPROVED,
                action_url=f"/communities/{community.slug}",
                target_type="community",
                target_id=str(community.id),
                metadata={
                    "community_id": str(community.id),
                    "community_slug": community.slug,
                    "community_name": community.name,
                    "member_id": str(member.id),
                    "decision": "approved",
                    "status": MembershipStatus.ACTIVE,
                },
            )
        else:
            NotificationService.create_notification(
                recipient=member.user,
                actor=actor_user,
                title=f"Demande d'adhésion refusée : {community.name}",
                body=f"Votre demande d'adhésion à la communauté {community.name} a été refusée.",
                notification_type=NotificationType.JOIN_REQUEST_REJECTED,
                action_url=f"/communities/{community.slug}",
                target_type="community",
                target_id=str(community.id),
                metadata={
                    "community_id": str(community.id),
                    "community_slug": community.slug,
                    "community_name": community.name,
                    "member_id": str(member.id),
                    "decision": "rejected",
                    "status": MembershipStatus.REJECTED,
                },
            )

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
        is_owner_actor = member.community.owner_id == actor_user.id or (
            actor_membership and actor_membership.role == CommunityRole.OWNER
        )

        if not is_superadmin_user(actor_user) and not is_owner_actor and (not actor_membership or not actor_membership.is_moderator):
            raise PermissionDenied("Droits de modération requis.")

        if member.role == CommunityRole.OWNER and not is_superadmin_user(actor_user):
            raise PermissionDenied("Impossible de sanctionner le propriétaire de la communauté.")

        if (
            member.role == CommunityRole.ADMIN
            and not is_superadmin_user(actor_user)
            and not is_owner_actor
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
                was_active = member.status == MembershipStatus.ACTIVE
                member.status = MembershipStatus.BANNED
                member.save(update_fields=['status', 'updated_at'])
                if was_active:
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
        is_owner = community.owner_id == actor_user.id

        if not is_superadmin_user(actor_user) and not is_owner:
            if not actor_membership:
                raise PermissionDenied("Vous n'êtes pas membre de cette communauté.")
            can_invite = (
                actor_membership.is_admin
                or getattr(getattr(community, 'settings', None), 'allow_member_invites', True)
                or has_community_permission(actor_user, community, 'can_invite_members')
            )
            if not can_invite:
                raise PermissionDenied("Les invitations par les membres sont désactivées.")
            if not actor_membership.is_admin and role != CommunityRole.MEMBER:
                raise PermissionDenied("Seul un administrateur peut inviter avec un rôle privilégié.")

        normalized_email = email.strip().lower() if email else ''
        now = timezone.now()

        if normalized_email:
            existing_user = User.objects.filter(email__iexact=normalized_email).first()
            if existing_user:
                is_already_member = (
                    community.owner_id == existing_user.id
                    or CommunityMember.objects.filter(
                        community=community,
                        user=existing_user,
                        status=MembershipStatus.ACTIVE
                    ).exists()
                )
                if is_already_member:
                    raise ConflictError(
                        message="Cette personne est déjà membre de cette communauté.",
                        code="already_member"
                    )

            existing_pending = CommunityInvitation.objects.filter(
                community=community,
                email__iexact=normalized_email,
                status=InvitationStatus.PENDING
            ).first()
            if existing_pending:
                if existing_pending.expires_at and existing_pending.expires_at < now:
                    existing_pending.status = InvitationStatus.EXPIRED
                    existing_pending.save(update_fields=['status', 'updated_at'])
                else:
                    raise ConflictError(
                        message="Une invitation en attente existe déjà pour cette adresse email dans cette communauté.",
                        code="invitation_already_pending"
                    )

        invite_code = secrets.token_urlsafe(24)
        token_hash = hash_token(invite_code)
        expires_at = now + timedelta(days=expires_in_days)

        invitation = CommunityInvitation.objects.create(
            community=community,
            invited_by=actor_user,
            email=normalized_email,
            invite_code=invite_code,
            token_hash=token_hash,
            role=role,
            status=InvitationStatus.PENDING,
            max_uses=max_uses,
            expires_at=expires_at
        )

        if normalized_email:
            existing_user = User.objects.filter(email__iexact=normalized_email).first()
            if existing_user:
                inviter_display = actor_user.get_full_name() or actor_user.username
                NotificationService.create_notification(
                    recipient=existing_user,
                    actor=actor_user,
                    title=f"Invitation à rejoindre {community.name}",
                    body=f"{inviter_display} vous invite à rejoindre la communauté {community.name}.",
                    notification_type=NotificationType.COMMUNITY_INVITE,
                    action_url=f"/invite/{invite_code}",
                    target_type="community_invitation",
                    target_id=str(invitation.id),
                    metadata={
                        "invitation_id": str(invitation.id),
                        "community_id": str(community.id),
                        "community_slug": community.slug,
                        "community_name": community.name,
                        "role": role,
                        "token": invite_code,
                    },
                )

        return invitation
