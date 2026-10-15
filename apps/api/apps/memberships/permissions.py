from rest_framework.permissions import BasePermission
from common.permissions.base import is_superadmin_user
from apps.communities.models.community import Community, CommunityPrivacy
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
    Allows read access if community is public, or requires active membership for private/secret spaces.
    Superadmins have full bypass permissions.
    """
    def has_permission(self, request, view):
        return True

    def has_object_permission(self, request, view, obj):
        community = obj if isinstance(obj, Community) else getattr(obj, 'community', None)
        if not community:
            return False

        if community.privacy_type == CommunityPrivacy.PUBLIC and request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True

        if not request.user or not request.user.is_authenticated:
            return False

        if is_superadmin_user(request.user) or community.owner_id == request.user.id:
            return True

        return CommunityMember.objects.filter(
            community=community,
            user=request.user,
            status=MembershipStatus.ACTIVE
        ).exists()
