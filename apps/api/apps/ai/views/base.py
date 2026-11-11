from rest_framework import status
from rest_framework.response import Response


def ai_success_response(
    data: dict, message: str = None, status_code=status.HTTP_200_OK
) -> Response:
    """
    Standardized API success envelope for AI endpoints.
    Provides {"success": True, "data": data, ...} conforming to the project convention
    while preserving top-level keys for existing client/test backward compatibility.
    """
    payload = {
        "success": True,
        "data": data,
    }
    if message is not None:
        payload["message"] = message
    if isinstance(data, dict):
        for k, v in data.items():
            if k not in payload:
                payload[k] = v
    return Response(payload, status=status_code)
