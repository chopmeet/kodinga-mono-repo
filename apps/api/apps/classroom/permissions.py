from rest_framework.permissions import BasePermission

from apps.communities.models.community import Community
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from common.permissions.base import is_superadmin_user


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

        from apps.memberships.permissions import has_community_permission
        return has_community_permission(request.user, community, 'can_manage_courses')



