from rest_framework import status
from rest_framework.response import Response


def success_response(data=None, message=None, status_code=status.HTTP_200_OK):
    """
    Standardized API success response envelope.
    """
    payload = {
        "success": True,
    }
    if message is not None:
        payload["message"] = message
    if data is not None:
        payload["data"] = data
    return Response(payload, status=status_code)


def error_response(message, code="error", details=None, status_code=status.HTTP_400_BAD_REQUEST):
    """
    Standardized API error response envelope.
    """
    payload = {
        "success": False,
        "code": code,
        "message": message,
    }
    if details is not None:
        payload["details"] = details
    return Response(payload, status=status_code)
