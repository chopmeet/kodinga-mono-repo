from rest_framework.permissions import BasePermission
from common.permissions.base import is_superadmin_user
from apps.communities.models.community import Community, CommunityPrivacy
from apps.memberships.models.member import CommunityMember, CommunityRole, MembershipStatus


class IsCommunityClassroomManager(BasePermission):
    """
    Allows only community owners and administrators to create, update, or delete courses/lessons.
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
        if not community and hasattr(obj, 'course'):
            community = obj.course.community
        if not community and hasattr(obj, 'module'):
            community = obj.module.course.community

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


class IsActiveCommunityMember(BasePermission):
    """
    Allows access ONLY to connected active community members (or owner/superadmin).
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        if is_superadmin_user(request.user):
            return True

        community = obj if isinstance(obj, Community) else getattr(obj, 'community', None)
        if not community and hasattr(obj, 'course'):
            community = obj.course.community
        if not community and hasattr(obj, 'module'):
            community = obj.module.course.community

        if not community:
            return False

        if community.owner_id == request.user.id:
            return True

        return CommunityMember.objects.filter(
            community=community,
            user=request.user,
            status=MembershipStatus.ACTIVE
        ).exists()
