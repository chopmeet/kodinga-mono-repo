from rest_framework.permissions import BasePermission
from apps.communities.models.community import Community, CommunityPrivacy
from apps.memberships.models.member import CommunityMember, CommunityRole, MembershipStatus


class IsCommunityOwner(BasePermission):
    """
    Permission checking that the user is the creator / owner of the target community.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True

        community = obj if isinstance(obj, Community) else getattr(obj, 'community', None)
        if not community:
            return False

        return community.owner_id == request.user.id


class IsCommunityAdmin(BasePermission):
    """
    Permission allowing community owners and assigned administrators.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
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
    """
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
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
    """
    def has_object_permission(self, request, view, obj):
        community = obj if isinstance(obj, Community) else getattr(obj, 'community', None)
        if not community:
            return False

        if community.privacy_type == CommunityPrivacy.PUBLIC and request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True

        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser or community.owner_id == request.user.id:
            return True

        return CommunityMember.objects.filter(
            community=community,
            user=request.user,
            status=MembershipStatus.ACTIVE
        ).exists()
