from rest_framework.permissions import BasePermission

from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from common.permissions.base import is_superadmin_user


class IsCommunityOwner(BasePermission):
    """
    Permission checking that the user is the creator / owner of the target community.
    Superadmins have full bypass permissions.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_superadmin_user(request.user):
            return True

        community = obj if isinstance(obj, Community) else getattr(obj, 'community', None)
        if not community:
            return False

        return community.owner_id == request.user.id


class IsCommunityAdmin(BasePermission):
    """
    Permission allowing community owners and assigned administrators.
    Superadmins have full bypass permissions.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_superadmin_user(request.user):
            return True

        community = obj if isinstance(obj, Community) else getattr(obj, 'community', None)
        if not community:
            return False

        if community.owner_id == request.user.id:
            return True

        return CommunityMember.objects.filter(
            community=community,
            user=request.user,
            status=MembershipStatus.ACTIVE,
            role__in=[CommunityRole.OWNER, CommunityRole.ADMIN]
        ).exists()


class IsCommunityModerator(BasePermission):
    """
    Permission allowing community moderators, admins and owners.
    Superadmins have full bypass permissions.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_superadmin_user(request.user):
            return True

        community = obj if isinstance(obj, Community) else getattr(obj, 'community', None)
        if not community:
            return False

        if community.owner_id == request.user.id:
            return True

        return CommunityMember.objects.filter(
            community=community,
            user=request.user,
            status=MembershipStatus.ACTIVE,
            role__in=[CommunityRole.OWNER, CommunityRole.ADMIN, CommunityRole.MODERATOR]
        ).exists()


class IsCommunityMemberOrPublic(BasePermission):
    """
    Allows read access if community is public and free, or requires active membership for private/secret/paid spaces.
    Superadmins have full bypass permissions.
    """
    def has_permission(self, request, view):
        return True

    def has_object_permission(self, request, view, obj):
        community = obj if isinstance(obj, Community) else getattr(obj, 'community', None)
        if not community:
            return False

        if (
            community.privacy_type == CommunityPrivacy.PUBLIC
            and getattr(community, 'pricing_type', None) == CommunityPricing.FREE
            and request.method in ['GET', 'HEAD', 'OPTIONS']
        ):
            return True

        if not request.user or not request.user.is_authenticated:
            return False

        if is_superadmin_user(request.user) or community.owner_id == request.user.id:
            return True

        return is_active_community_member(request.user, community)


def is_active_community_member(user, community) -> bool:
    """
    Returns True if user is a superadmin, community creator/owner,
    has an ACTIVE membership, or has an active paid subscription in the given community.
    """
    if not user or not user.is_authenticated or not community:
        return False
    if is_superadmin_user(user) or getattr(community, 'owner_id', None) == user.id:
        return True
    if CommunityMember.objects.filter(
        community=community,
        user=user,
        status=MembershipStatus.ACTIVE,
    ).exists():
        return True
    try:
        from django.utils import timezone

        from apps.billing.models.subscription import Subscription, SubscriptionStatus
        return Subscription.objects.filter(
            user=user,
            community=community,
            status=SubscriptionStatus.ACTIVE,
            current_period_end__gt=timezone.now()
        ).exists()
    except Exception:
        return False


def check_community_membership(user, community, action_label: str = "effectuer cette action") -> None:
    """
    Raises rest_framework.exceptions.PermissionDenied if user is not an active member
    of the specified community.
    """
    from rest_framework.exceptions import PermissionDenied

    if not is_active_community_member(user, community):
        raise PermissionDenied(
            f"Vous devez être membre actif de cette communauté pour {action_label}."
        )


def check_community_read_permission(user, community) -> None:
    """
    Verifies that the user has read permissions for the community content (feed, posts, comments, channels).
    If the community is private, secret, or paid:
      - Unauthenticated users receive NotAuthenticated (HTTP 401).
      - Authenticated users who are not active members/subscribers receive PermissionDenied (HTTP 403).
      - Active members, owners, and superadmins are allowed.
    If the community is public and free:
      - Public read access is allowed for anyone.
    """
    from rest_framework.exceptions import NotAuthenticated, PermissionDenied

    if not community:
        return

    is_restricted = (
        getattr(community, 'privacy_type', None) in [CommunityPrivacy.PRIVATE, CommunityPrivacy.SECRET]
        or getattr(community, 'pricing_type', None) == CommunityPricing.PAID
    )

    if not is_restricted:
        return

    if not user or not user.is_authenticated:
        raise NotAuthenticated("Authentification requise pour accéder au contenu de cette communauté.")

    if not is_active_community_member(user, community):
        raise PermissionDenied("Vous devez être membre actif ou abonné de cette communauté pour accéder à son contenu.")


class IsActiveCommunityMember(BasePermission):
    """
    Allows access only to active connected community members (or owner/superadmin).
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        community = obj if isinstance(obj, Community) else getattr(obj, "community", None)
        if not community and hasattr(obj, "course"):
            community = obj.course.community
        if not community and hasattr(obj, "module"):
            community = obj.module.course.community
        if not community and hasattr(obj, "post"):
            community = obj.post.community
        if not community and hasattr(obj, "hackathon"):
            community = obj.hackathon.community

        if not community:
            return False

        return is_active_community_member(request.user, community)


IsWorkspaceAdmin = IsCommunityAdmin


def check_last_admin_protection(community: Community, target_user_id) -> None:
    """
    Prevents downgrading or removing the sole remaining active administrator/owner of a workspace.
    """
    from common.exceptions.handler import BusinessLogicError

    active_admins = CommunityMember.objects.filter(
        community=community,
        status=MembershipStatus.ACTIVE,
        role__in=[CommunityRole.OWNER, CommunityRole.ADMIN]
    )
    if active_admins.count() <= 1 and active_admins.filter(user_id=target_user_id).exists():
        raise BusinessLogicError(
            message="Le dernier administrateur d'un espace ne peut pas être rétrogradé ni retiré.",
            code="last_admin_protection"
        )


def get_community_member_role(user, community) -> str | None:
    """
    Returns the role ('owner', 'admin', 'moderator', 'member') of the user in the given community.
    Returns 'owner' if the user is the creator/owner of the community or a superadmin.
    Returns None if the user is not an active member.
    """
    if not user or not user.is_authenticated or not community:
        return None
    if is_superadmin_user(user) or getattr(community, 'owner_id', None) == user.id:
        return CommunityRole.OWNER

    member = CommunityMember.objects.filter(
        community=community,
        user=user,
        status=MembershipStatus.ACTIVE,
    ).only('role').first()
    return member.role if member else None


def has_community_permission(user, community, permission_name: str) -> bool:
    """
    Evaluates whether the user has a specific community permission,
    checking dynamic CommunitySettings.role_permissions overrides and defaults.
    Superadmins and community owners always return True.
    """
    if not user or not user.is_authenticated or not community:
        return False
    if is_superadmin_user(user) or getattr(community, 'owner_id', None) == user.id:
        return True

    role = get_community_member_role(user, community)
    if not role:
        return False

    settings = getattr(community, 'settings', None)
    if not settings:
        from apps.communities.models.settings import CommunitySettings
        settings, _ = CommunitySettings.objects.get_or_create(community=community)

    # Check direct member overrides if configured in settings
    user_overrides = (settings.role_permissions or {}).get('user_overrides', {}).get(str(user.id), {})
    if permission_name in user_overrides:
        return bool(user_overrides[permission_name])

    return settings.has_permission(role, permission_name)


def check_community_permission(user, community, permission_name: str, action_label: str = "effectuer cette action") -> None:
    """
    Raises rest_framework.exceptions.PermissionDenied if user lacks the specified community permission.
    """
    from rest_framework.exceptions import PermissionDenied

    if not has_community_permission(user, community, permission_name):
        raise PermissionDenied(f"Votre rôle actuel ne vous permet pas de {action_label}.")


