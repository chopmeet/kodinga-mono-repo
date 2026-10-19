from django.conf import settings
from django.core.cache import caches
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle


class WorkspaceInvitationRateThrottle(SimpleRateThrottle):
    """
    Limits invitation creation to a maximum of 20 invitations per hour per workspace.
    """
    scope = 'workspace_invitations'
    rate = '20/hour'

    @property
    def cache(self):
        return caches['default']

    def allow_request(self, request, view):
        if getattr(settings, 'IS_TESTING', False):
            return True
        return super().allow_request(request, view)

    def get_cache_key(self, request, view):
        workspace_id = (
            view.kwargs.get('workspace_id')
            or view.kwargs.get('id')
            or view.kwargs.get('slug')
        )
        if not workspace_id:
            return None
        return f"throttle_workspace_invitations_{workspace_id}"


class PublicInvitationRateThrottle(AnonRateThrottle):
    """
    Limits public token lookup requests per IP to prevent token enumeration / brute force.
    """
    scope = 'public_invitations'
    rate = '30/minute'

    @property
    def cache(self):
        return caches['default']

    def allow_request(self, request, view):
        if getattr(settings, 'IS_TESTING', False):
            return True
        return super().allow_request(request, view)
