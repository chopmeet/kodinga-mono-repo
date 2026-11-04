import logging
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models.user import User
from apps.administration.models.audit import PlatformAuditLog
from apps.communities.models.community import Community
from apps.memberships.models.invitation import (
    CommunityInvitation,
    InvitationStatus,
)
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.memberships.permissions import has_community_permission, is_superadmin_user
from apps.memberships.tasks import (
    send_invitation_accepted_notice_async,
    send_invitation_email_async,
)
from apps.notifications.models.notification import NotificationType
from apps.notifications.services.notification_service import NotificationService
from common.exceptions.handler import (
    ApplicationError,
    ConflictError,
    ResourceNotFoundError,
)
from common.utils.tokens import generate_secure_token, hash_token

logger = logging.getLogger('kodinga.memberships')

ROLE_MAPPING = {
    'admin': CommunityRole.ADMIN,
    'editor': CommunityRole.MODERATOR,
    'moderator': CommunityRole.MODERATOR,
    'viewer': CommunityRole.MEMBER,
    'member': CommunityRole.MEMBER,
}

REVERSE_ROLE_DISPLAY = {
    CommunityRole.OWNER: 'Propriétaire',
    CommunityRole.ADMIN: 'Administrateur',
    CommunityRole.MODERATOR: 'Éditeur / Modérateur',
    CommunityRole.MEMBER: 'Membre / Lecteur',
}


def mask_email(email: str) -> str:
    """
    Masks an email address for safe public disclosure (e.g. j***e@example.com).
    """
    if not email or '@' not in email:
        return '***'
    user_part, domain_part = email.split('@', 1)
    if len(user_part) <= 2:
        masked_user = user_part[0] + '***'
    else:
        masked_user = user_part[0] + '***' + user_part[-1]
    return f"{masked_user}@{domain_part}"


def _is_uuid(val: str) -> bool:
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


class InvitationService:
    """
    Encapsulates all workspace collaborator invitation lifecycle logic:
    cryptographic token generation, SHA-256 persistence, email dispatch,
    in-app notifications, idempotent atomic acceptance, decline, resend,
    revocation, and audit logging.
    """

    @classmethod
    def normalize_role(cls, role_input: str) -> str:
        role_key = (role_input or '').strip().lower()
        if role_key in ROLE_MAPPING:
            return ROLE_MAPPING[role_key]
        if role_key in dict(CommunityRole.choices):
            return role_key
        return CommunityRole.MEMBER

    @classmethod
    def get_role_display(cls, role: str) -> str:
        return REVERSE_ROLE_DISPLAY.get(role, role.capitalize())

    @classmethod
    def create_invitation(
        cls,
        actor_user: User,
        workspace: Community,
        email: str,
        role: str = 'viewer',
        expires_in_days: int = 7,
        request=None,
        allow_member_invite: bool = False,
    ) -> tuple[CommunityInvitation, str]:
        """
        Creates a new collaborator invitation and schedules async email dispatch + in-app notification.
        Enforces admin/invite rights, email normalization, single pending constraint,
        and ensures user is not already an active member.
        """
        normalized_email = (email or '').strip().lower()
        if not normalized_email or '@' not in normalized_email:
            raise ApplicationError("Adresse email d'invitation invalide.", code="invalid_email", status_code=400)

        target_role = cls.normalize_role(role)

        # 1. Authorization: actor must be workspace admin, owner, superadmin, or member with invite permission (when allow_member_invite=True and role is member)
        is_owner_or_super = is_superadmin_user(actor_user) or workspace.owner_id == actor_user.id
        if not is_owner_or_super:
            actor_member = CommunityMember.objects.filter(
                community=workspace,
                user=actor_user,
                status=MembershipStatus.ACTIVE
            ).first()
            can_member_invite = (
                allow_member_invite
                and actor_member is not None
                and target_role == CommunityRole.MEMBER
                and (
                    getattr(getattr(workspace, 'settings', None), 'allow_member_invites', False)
                    or has_community_permission(actor_user, workspace, 'can_invite_members')
                )
            )
            if not actor_member or (not actor_member.is_admin and not can_member_invite):
                raise PermissionDenied("Droits administrateur requis pour inviter des collaborateurs.")

        if target_role == CommunityRole.OWNER and not is_owner_or_super:
            raise PermissionDenied("Seul le propriétaire actuel peut désigner un propriétaire.")

        # 2. Check if already active member
        existing_user = User.objects.filter(email__iexact=normalized_email).first()
        if existing_user:
            is_active_member = (
                workspace.owner_id == existing_user.id
                or CommunityMember.objects.filter(
                    community=workspace,
                    user=existing_user,
                    status=MembershipStatus.ACTIVE
                ).exists()
            )
            if is_active_member:
                raise ConflictError(
                    message="Cette personne est déjà membre de cet espace.",
                    code="already_member"
                )

        # 3. Check if active pending invitation already exists
        existing_pending = CommunityInvitation.objects.filter(
            community=workspace,
            email__iexact=normalized_email,
            status=InvitationStatus.PENDING
        ).first()

        now = timezone.now()
        if existing_pending:
            if existing_pending.expires_at and existing_pending.expires_at < now:
                # Mark as expired so new one can be created
                existing_pending.status = InvitationStatus.EXPIRED
                existing_pending.save(update_fields=['status', 'updated_at'])
            else:
                raise ConflictError(
                    message="Une invitation en attente existe déjà pour cette adresse email dans cet espace.",
                    code="invitation_already_pending"
                )

        # 4. Generate cryptographically strong random token (32 bytes) and its SHA-256 hash
        raw_token = generate_secure_token(32)
        token_hash = hash_token(raw_token)
        expires_at = now + timedelta(days=expires_in_days)

        with transaction.atomic():
            invitation = CommunityInvitation.objects.create(
                community=workspace,
                invited_by=actor_user,
                email=normalized_email,
                token_hash=token_hash,
                role=target_role,
                status=InvitationStatus.PENDING,
                max_uses=1,
                uses_count=0,
                expires_at=expires_at
            )

            # Audit log
            PlatformAuditLog.objects.create(
                actor=actor_user,
                action='workspace.invitation_created',
                target_type='community_invitation',
                target_id=str(invitation.id),
                details={
                    'workspace_id': str(workspace.id),
                    'workspace_name': workspace.name,
                    'invited_email': normalized_email,
                    'role': target_role,
                    'expires_at': expires_at.isoformat(),
                },
                ip_address=request.META.get('REMOTE_ADDR') if request else None,
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:255] if request else ''
            )

        # 5. Create in-app notification if recipient is a registered user
        inviter_display = actor_user.get_full_name() or actor_user.username
        if existing_user:
            NotificationService.create_notification(
                recipient=existing_user,
                actor=actor_user,
                title=f"Invitation à rejoindre {workspace.name}",
                body=f"{inviter_display} vous invite à rejoindre la communauté {workspace.name} en tant que {cls.get_role_display(target_role)}.",
                notification_type=NotificationType.COMMUNITY_INVITE,
                action_url=f"/invite/{raw_token}",
                target_type="community_invitation",
                target_id=str(invitation.id),
                metadata={
                    "invitation_id": str(invitation.id),
                    "community_id": str(workspace.id),
                    "community_slug": workspace.slug,
                    "community_name": workspace.name,
                    "role": target_role,
                    "token": raw_token,
                },
            )

        # 6. Dispatch transactional email asynchronously via Celery
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        invite_url = f"{frontend_url}/invite/{raw_token}"
        email_context = {
            'inviter_name': inviter_display,
            'workspace_name': workspace.name,
            'role_display': cls.get_role_display(target_role),
            'invite_url': invite_url,
            'expires_at_formatted': expires_at.strftime('%d/%m/%Y à %H:%M UTC'),
            'expires_in_days': expires_in_days,
        }

        try:
            send_invitation_email_async.delay(
                to_email=normalized_email,
                subject=f"Invitation à rejoindre l'espace {workspace.name} - {getattr(settings, 'APP_NAME', 'Kodinga')}",
                context=email_context
            )
        except Exception as exc:
            logger.warning(f"Celery queueing failed, sending synchronously as fallback: {exc}")
            from common.services.email_service import EmailService
            EmailService.send_mail(
                to_email=normalized_email,
                subject=f"Invitation à rejoindre l'espace {workspace.name} - {getattr(settings, 'APP_NAME', 'Kodinga')}",
                template_name='workspace_invitation',
                context=email_context,
                fail_silently=True
            )

        return invitation, raw_token

    @classmethod
    def _resolve_invitation_locked(cls, raw_token_or_id: str) -> CommunityInvitation | None:
        cleaned = (raw_token_or_id or '').strip()
        if not cleaned:
            return None
        token_hash = hash_token(cleaned)
        q = models.Q(token_hash=token_hash) | models.Q(invite_code=cleaned)
        if _is_uuid(cleaned):
            q = q | models.Q(id=cleaned)
        return CommunityInvitation.objects.select_for_update().select_related(
            'community'
        ).filter(q).first()

    @classmethod
    def get_public_invitation_info(cls, raw_token: str) -> dict:
        """
        Public resolver returning minimal metadata to populate the invitation acceptance page
        without requiring prior authentication. Protects sensitive workspace details.
        """
        cleaned = (raw_token or '').strip()
        token_hash = hash_token(cleaned)
        q = models.Q(token_hash=token_hash) | models.Q(invite_code=cleaned)
        if _is_uuid(cleaned):
            q = q | models.Q(id=cleaned)
        invitation = CommunityInvitation.objects.select_related('community', 'invited_by').filter(q).first()

        if not invitation:
            raise ResourceNotFoundError("Invitation introuvable ou lien invalide.", code="invitation_not_found")

        now = timezone.now()
        is_expired = bool(invitation.expires_at and invitation.expires_at <= now)
        if is_expired and invitation.status == InvitationStatus.PENDING:
            invitation.status = InvitationStatus.EXPIRED
            invitation.save(update_fields=['status', 'updated_at'])

        return {
            'id': str(invitation.id),
            'workspace_id': str(invitation.community.id),
            'workspace_name': invitation.community.name,
            'workspace_slug': invitation.community.slug,
            'workspace_avatar_url': invitation.community.avatar_url,
            'role': invitation.role,
            'role_display': cls.get_role_display(invitation.role),
            'masked_email': mask_email(invitation.email),
            'status': invitation.status,
            'expires_at': invitation.expires_at.isoformat() if invitation.expires_at else None,
            'is_valid': invitation.is_valid,
        }

    @classmethod
    def accept_invitation(cls, user: User, raw_token: str, request=None) -> CommunityMember:
        """
        Accepts an invitation atomically under database row lock.
        Guarantees idempotency and verifies that the authenticated user's email
        matches the invited email address.
        """
        if not user or not user.is_authenticated:
            raise PermissionDenied("Authentification requise pour accepter cette invitation.")

        with transaction.atomic():
            invitation = cls._resolve_invitation_locked(raw_token)

            if not invitation:
                raise ResourceNotFoundError("Invitation introuvable ou lien invalide.", code="invitation_not_found")

            # Check validity
            now = timezone.now()
            if invitation.status == InvitationStatus.EXPIRED or (invitation.expires_at and invitation.expires_at < now):
                invitation.status = InvitationStatus.EXPIRED
                invitation.save(update_fields=['status', 'updated_at'])
                raise ApplicationError(
                    message="Cette invitation a expiré. Veuillez contacter un administrateur pour en obtenir une nouvelle.",
                    code="invitation_expired",
                    status_code=400
                )

            if invitation.status == InvitationStatus.REVOKED:
                raise ApplicationError(
                    message="Cette invitation a été révoquée par un administrateur.",
                    code="invitation_revoked",
                    status_code=400
                )

            if invitation.status == InvitationStatus.DECLINED:
                raise ApplicationError(
                    message="Cette invitation a été refusée.",
                    code="invitation_declined",
                    status_code=400
                )

            if invitation.status == InvitationStatus.ACCEPTED:
                raise ConflictError(
                    message="Cette invitation a déjà été acceptée.",
                    code="invitation_already_accepted"
                )

            # Security verification: recipient email matching (when email is specified)
            user_email = user.email.strip().lower()
            invited_email = (invitation.email or '').strip().lower()

            if invited_email and user_email != invited_email:
                masked = mask_email(invited_email)
                raise PermissionDenied(
                    f"Cette invitation a été envoyée à l'adresse {masked}. Vous devez vous connecter avec cette adresse email pour rejoindre l'espace."
                )

            # Create or reactivate membership
            member = CommunityMember.objects.filter(
                community=invitation.community,
                user=user
            ).first()

            if member:
                if member.status == MembershipStatus.ACTIVE:
                    # Idempotent return if already active member
                    invitation.status = InvitationStatus.ACCEPTED
                    invitation.accepted_at = now
                    invitation.save(update_fields=['status', 'accepted_at', 'updated_at'])
                    return member
                member.status = MembershipStatus.ACTIVE
                member.role = invitation.role
                member.save(update_fields=['status', 'role', 'updated_at'])
            else:
                member = CommunityMember.objects.create(
                    community=invitation.community,
                    user=user,
                    role=invitation.role,
                    status=MembershipStatus.ACTIVE
                )

            # Update invitation status atomically
            invitation.uses_count = (invitation.uses_count or 0) + 1
            is_unlimited = (invitation.max_uses == 0)
            has_reached_max = bool(invitation.max_uses and invitation.max_uses > 0 and invitation.uses_count >= invitation.max_uses)
            if invited_email or (not is_unlimited and has_reached_max):
                invitation.status = InvitationStatus.ACCEPTED
                invitation.accepted_at = now
            invitation.save(update_fields=['status', 'accepted_at', 'uses_count', 'updated_at'])

            # Increment community member count
            Community.objects.filter(id=invitation.community_id).update(
                members_count=F('members_count') + 1
            )

            # Audit log
            PlatformAuditLog.objects.create(
                actor=user,
                action='workspace.invitation_accepted',
                target_type='community_member',
                target_id=str(member.id),
                details={
                    'workspace_id': str(invitation.community.id),
                    'workspace_name': invitation.community.name,
                    'role': invitation.role,
                    'accepted_email': user.email,
                },
                ip_address=request.META.get('REMOTE_ADDR') if request else None,
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:255] if request else ''
            )

        # Notify inviter via in-app notification & email
        inviter = invitation.invited_by
        member_display = user.get_full_name() or user.username
        if inviter:
            NotificationService.create_notification(
                recipient=inviter,
                actor=user,
                title=f"Invitation acceptée : {member_display}",
                body=f"{member_display} a accepté votre invitation et a rejoint la communauté {invitation.community.name}.",
                notification_type=NotificationType.COMMUNITY_INVITE,
                action_url=f"/communities/{invitation.community.slug}/members",
                target_type="community_member",
                target_id=str(member.id),
                metadata={
                    "community_id": str(invitation.community.id),
                    "community_slug": invitation.community.slug,
                    "invitation_id": str(invitation.id),
                    "status": InvitationStatus.ACCEPTED,
                },
            )

        if inviter and inviter.email:
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
            notice_context = {
                'admin_name': inviter.get_full_name() or inviter.username,
                'workspace_name': invitation.community.name,
                'member_name': member_display,
                'member_email': user.email,
                'role_display': cls.get_role_display(invitation.role),
                'workspace_members_url': f"{frontend_url}/c/{invitation.community.slug}/members",
            }
            try:
                send_invitation_accepted_notice_async.delay(
                    to_email=inviter.email,
                    subject=f"Invitation acceptée pour l'espace {invitation.community.name}",
                    context=notice_context
                )
            except Exception as exc:
                logger.warning(f"Could not dispatch admin acceptance notice: {exc}")

        return member

    @classmethod
    def decline_invitation(cls, user: User, raw_token: str, request=None) -> CommunityInvitation:
        """
        Declines a pending invitation atomically and notifies the inviter.
        """
        if not user or not user.is_authenticated:
            raise PermissionDenied("Authentification requise pour refuser cette invitation.")

        with transaction.atomic():
            invitation = cls._resolve_invitation_locked(raw_token)

            if not invitation:
                raise ResourceNotFoundError("Invitation introuvable ou lien invalide.", code="invitation_not_found")

            now = timezone.now()
            if invitation.status == InvitationStatus.DECLINED:
                return invitation

            if invitation.status == InvitationStatus.ACCEPTED:
                raise ConflictError(
                    message="Cette invitation a déjà été acceptée et ne peut plus être refusée.",
                    code="invitation_already_accepted"
                )

            if invitation.status == InvitationStatus.REVOKED:
                raise ApplicationError(
                    message="Cette invitation a été révoquée.",
                    code="invitation_revoked",
                    status_code=400
                )

            if invitation.status == InvitationStatus.EXPIRED or (invitation.expires_at and invitation.expires_at < now):
                invitation.status = InvitationStatus.EXPIRED
                invitation.save(update_fields=['status', 'updated_at'])
                raise ApplicationError(
                    message="Cette invitation a expiré.",
                    code="invitation_expired",
                    status_code=400
                )

            user_email = user.email.strip().lower()
            invited_email = (invitation.email or '').strip().lower()
            if invited_email and user_email != invited_email:
                masked = mask_email(invited_email)
                raise PermissionDenied(
                    f"Cette invitation a été envoyée à l'adresse {masked}. Vous ne pouvez pas la refuser avec un autre compte."
                )

            invitation.status = InvitationStatus.DECLINED
            invitation.declined_at = now
            invitation.save(update_fields=['status', 'declined_at', 'updated_at'])

            PlatformAuditLog.objects.create(
                actor=user,
                action='workspace.invitation_declined',
                target_type='community_invitation',
                target_id=str(invitation.id),
                details={
                    'workspace_id': str(invitation.community.id),
                    'workspace_name': invitation.community.name,
                    'declined_email': user.email,
                },
                ip_address=request.META.get('REMOTE_ADDR') if request else None,
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:255] if request else ''
            )

        if invitation.invited_by:
            member_display = user.get_full_name() or user.username
            NotificationService.create_notification(
                recipient=invitation.invited_by,
                actor=user,
                title=f"Invitation déclinée : {invitation.community.name}",
                body=f"{member_display} a décliné votre invitation à rejoindre la communauté {invitation.community.name}.",
                notification_type=NotificationType.COMMUNITY_INVITE,
                action_url=f"/communities/{invitation.community.slug}/members",
                target_type="community_invitation",
                target_id=str(invitation.id),
                metadata={
                    "community_id": str(invitation.community.id),
                    "community_slug": invitation.community.slug,
                    "invitation_id": str(invitation.id),
                    "status": InvitationStatus.DECLINED,
                },
            )

        return invitation

    @classmethod
    def resend_invitation(
        cls,
        actor_user: User,
        workspace: Community,
        invitation_id,
        request=None
    ) -> tuple[CommunityInvitation, str]:
        """
        Regenerates a fresh token and resets expiration for an existing invitation.
        """
        if not is_superadmin_user(actor_user) and workspace.owner_id != actor_user.id:
            actor_member = CommunityMember.objects.filter(
                community=workspace,
                user=actor_user,
                status=MembershipStatus.ACTIVE
            ).first()
            if not actor_member or not actor_member.is_admin:
                raise PermissionDenied("Droits administrateur requis pour renvoyer une invitation.")

        invitation = CommunityInvitation.objects.filter(
            id=invitation_id,
            community=workspace
        ).first()

        if not invitation:
            raise ResourceNotFoundError("Invitation introuvable dans cet espace.", code="invitation_not_found")

        if invitation.status == InvitationStatus.ACCEPTED:
            raise ConflictError("Cette invitation a déjà été acceptée.", code="already_accepted")

        now = timezone.now()
        raw_token = generate_secure_token(32)
        token_hash = hash_token(raw_token)
        expires_at = now + timedelta(days=7)

        with transaction.atomic():
            invitation.token_hash = token_hash
            invitation.expires_at = expires_at
            invitation.status = InvitationStatus.PENDING
            invitation.declined_at = None
            invitation.save(update_fields=['token_hash', 'expires_at', 'status', 'declined_at', 'updated_at'])

            PlatformAuditLog.objects.create(
                actor=actor_user,
                action='workspace.invitation_resent',
                target_type='community_invitation',
                target_id=str(invitation.id),
                details={
                    'workspace_id': str(workspace.id),
                    'email': invitation.email,
                    'new_expires_at': expires_at.isoformat(),
                },
                ip_address=request.META.get('REMOTE_ADDR') if request else None,
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:255] if request else ''
            )

        existing_user = User.objects.filter(email__iexact=invitation.email).first() if invitation.email else None
        inviter_display = actor_user.get_full_name() or actor_user.username
        if existing_user:
            NotificationService.create_notification(
                recipient=existing_user,
                actor=actor_user,
                title=f"Rappel : Invitation à rejoindre {workspace.name}",
                body=f"{inviter_display} vous a renvoyé une invitation pour rejoindre {workspace.name}.",
                notification_type=NotificationType.COMMUNITY_INVITE,
                action_url=f"/invite/{raw_token}",
                target_type="community_invitation",
                target_id=str(invitation.id),
                metadata={
                    "invitation_id": str(invitation.id),
                    "community_id": str(workspace.id),
                    "community_slug": workspace.slug,
                    "token": raw_token,
                },
            )

        # Dispatch async email
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        invite_url = f"{frontend_url}/invite/{raw_token}"
        email_context = {
            'inviter_name': inviter_display,
            'workspace_name': workspace.name,
            'role_display': cls.get_role_display(invitation.role),
            'invite_url': invite_url,
            'expires_at_formatted': expires_at.strftime('%d/%m/%Y à %H:%M UTC'),
            'expires_in_days': 7,
        }

        try:
            send_invitation_email_async.delay(
                to_email=invitation.email,
                subject=f"Relance : Invitation à rejoindre {workspace.name} - {getattr(settings, 'APP_NAME', 'Kodinga')}",
                context=email_context
            )
        except Exception as exc:
            logger.warning(f"Celery queueing failed, sending synchronously: {exc}")
            from common.services.email_service import EmailService
            EmailService.send_mail(
                to_email=invitation.email,
                subject=f"Relance : Invitation à rejoindre {workspace.name} - {getattr(settings, 'APP_NAME', 'Kodinga')}",
                template_name='workspace_invitation',
                context=email_context,
                fail_silently=True
            )

        return invitation, raw_token

    @classmethod
    def revoke_invitation(
        cls,
        actor_user: User,
        workspace: Community,
        invitation_id,
        request=None
    ) -> CommunityInvitation:
        """
        Revokes a pending invitation.
        """
        if not is_superadmin_user(actor_user) and workspace.owner_id != actor_user.id:
            actor_member = CommunityMember.objects.filter(
                community=workspace,
                user=actor_user,
                status=MembershipStatus.ACTIVE
            ).first()
            if not actor_member or not actor_member.is_admin:
                raise PermissionDenied("Droits administrateur requis pour révoquer une invitation.")

        invitation = CommunityInvitation.objects.filter(
            id=invitation_id,
            community=workspace
        ).first()

        if not invitation:
            raise ResourceNotFoundError("Invitation introuvable dans cet espace.", code="invitation_not_found")

        if invitation.status == InvitationStatus.ACCEPTED:
            raise ConflictError("Impossible de révoquer une invitation déjà acceptée.", code="already_accepted")

        with transaction.atomic():
            invitation.status = InvitationStatus.REVOKED
            invitation.save(update_fields=['status', 'updated_at'])

            PlatformAuditLog.objects.create(
                actor=actor_user,
                action='workspace.invitation_revoked',
                target_type='community_invitation',
                target_id=str(invitation.id),
                details={
                    'workspace_id': str(workspace.id),
                    'email': invitation.email,
                },
                ip_address=request.META.get('REMOTE_ADDR') if request else None,
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:255] if request else ''
            )

        return invitation


    @classmethod
    def get_or_create_shareable_link(
        cls,
        actor_user: User,
        workspace: Community,
        role: str = 'member',
        expires_in_days: int = 30,
        request=None,
    ) -> tuple[CommunityInvitation, str]:
        """
        Creates or retrieves an active shareable invitation link for a workspace without requiring an email.
        """
        target_role = cls.normalize_role(role)

        is_owner_or_super = is_superadmin_user(actor_user) or workspace.owner_id == actor_user.id
        if not is_owner_or_super:
            actor_member = CommunityMember.objects.filter(
                community=workspace,
                user=actor_user,
                status=MembershipStatus.ACTIVE
            ).first()
            can_member_invite = (
                actor_member is not None
                and target_role == CommunityRole.MEMBER
                and (
                    getattr(getattr(workspace, 'settings', None), 'allow_member_invites', False)
                    or has_community_permission(actor_user, workspace, 'can_invite_members')
                )
            )
            if not actor_member or (not actor_member.is_admin and not can_member_invite):
                raise PermissionDenied("Droits administrateur requis pour générer un lien d'invitation.")

        now = timezone.now()
        existing = CommunityInvitation.objects.filter(
            community=workspace,
            email='',
            role=target_role,
            status=InvitationStatus.PENDING,
            expires_at__gt=now,
        ).order_by('-created_at').first()

        if existing and existing.invite_code:
            return existing, existing.invite_code

        raw_token = generate_secure_token(32)
        token_hash = hash_token(raw_token)
        expires_at = now + timedelta(days=expires_in_days)

        invitation = CommunityInvitation.objects.create(
            community=workspace,
            invited_by=actor_user,
            email='',
            token_hash=token_hash,
            invite_code=raw_token,
            role=target_role,
            status=InvitationStatus.PENDING,
            max_uses=0,
            expires_at=expires_at,
        )

        return invitation, raw_token
