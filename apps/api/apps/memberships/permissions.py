from rest_framework.permissions import BasePermission
from common.permissions.base import is_superadmin_user
from apps.communities.models.community import Community, CommunityPrivacy, CommunityPricing
from apps.memberships.models.member import CommunityMember, CommunityRole, MembershipStatus


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
        from apps.billing.models.subscription import Subscription, SubscriptionStatus
        from django.utils import timezone
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

