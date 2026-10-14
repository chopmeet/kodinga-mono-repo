from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOwner(BasePermission):
    """
    Object-level permission allowing only the owner of the object to access/edit it.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        return False


class IsOwnerOrReadOnly(BasePermission):
    """
    Allows read-only access for any authenticated/safe method, but restricts writes to the owner.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if not request.user or not request.user.is_authenticated:
            return False
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        return False


class IsPlatformAdmin(BasePermission):
    """
    Allows access only to authenticated users who are platform superadmins,
    superusers, or staff members.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (
                getattr(request.user, 'is_superadmin', False) or
                getattr(request.user, 'is_superuser', False) or
                getattr(request.user, 'is_staff', False)
            )
        )

