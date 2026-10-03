"""API views."""

from django.http import JsonResponse


def health(request):
    """Liveness probe used by Docker and the web proxy."""
    return JsonResponse({"status": "ok"})
