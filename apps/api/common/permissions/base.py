from rest_framework.permissions import SAFE_METHODS, BasePermission


def is_superadmin_user(user) -> bool:
    """
    Returns True if user is authenticated and is a platform superadmin or superuser.
    Superadmins possess full, unrestricted access to all platform resources and actions.
    """
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    return bool(
        getattr(user, 'is_superadmin', False) or
        getattr(user, 'is_superuser', False)
    )


class IsOwner(BasePermission):
    """
    Object-level permission allowing only the owner of the object to access/edit it.
    Platform superadmins have full bypass permissions.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_superadmin_user(request.user):
            return True
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        if hasattr(obj, 'author'):
            return obj.author == request.user
        return False


class IsOwnerOrReadOnly(BasePermission):
    """
    Allows read-only access for any authenticated/safe method, but restricts writes to the owner.
    Platform superadmins have full bypass permissions across all HTTP methods.
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if not request.user or not request.user.is_authenticated:
            return False
        if is_superadmin_user(request.user):
            return True
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'owner'):
            return obj.owner == request.user
        if hasattr(obj, 'author'):
            return obj.author == request.user
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

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)

