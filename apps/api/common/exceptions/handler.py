import logging
from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger('kodinga.api')


class ApplicationError(Exception):
    """Base application exception for business domain errors."""
    default_message = "An error occurred."
    default_code = "application_error"
    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, message=None, code=None, status_code=None, details=None):
        self.message = message or self.default_message
        self.code = code or self.default_code
        self.status_code = status_code or self.status_code
        self.details = details or {}
        super().__init__(self.message)


class BusinessLogicError(ApplicationError):
    default_message = "Operation failed due to business logic constraint."
    default_code = "business_logic_error"
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY


class ResourceNotFoundError(ApplicationError):
    default_message = "Requested resource not found."
    default_code = "resource_not_found"
    status_code = status.HTTP_404_NOT_FOUND


class ConflictError(ApplicationError):
    default_message = "Resource state conflict."
    default_code = "conflict"
    status_code = status.HTTP_409_CONFLICT


class ThrottledError(ApplicationError):
    default_message = "Request rate limit exceeded. Please try again later."
    default_code = "throttled"
    status_code = status.HTTP_429_TOO_MANY_REQUESTS


def custom_exception_handler(exc, context):
    """
    Standardized DRF Exception Handler guaranteeing consistent JSON schema across all errors.
    """
    if isinstance(exc, ApplicationError):
        return Response(
            {
                "success": False,
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            },
            status=exc.status_code
        )

    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, 'message_dict'):
            details = exc.message_dict
        elif hasattr(exc, 'messages'):
            details = {'non_field_errors': exc.messages}
        else:
            details = {'non_field_errors': [str(exc)]}
        return Response(
            {
                "success": False,
                "code": "validation_error",
                "message": "Validation failed.",
                "details": details,
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)

    if response is not None:
        code = getattr(exc, 'default_code', 'error')
        details = response.data

        if isinstance(details, dict):
            detail_msg = details.get('detail')
            if detail_msg and len(details) == 1:
                message = str(detail_msg)
                details = {}
            else:
                message = "Validation or processing error."
        elif isinstance(details, list):
            message = "Validation or processing error."
            details = {'non_field_errors': details}
        else:
            message = str(details)
            details = {}

        response.data = {
            "success": False,
            "code": str(code),
            "message": message,
            "details": details,
        }
        return response

    logger.exception(f"Unhandled server exception: {exc}", exc_info=context.get('request'))
    return Response(
        {
            "success": False,
            "code": "internal_server_error",
            "message": "An unexpected server error occurred. Please try again later.",
            "details": {},
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )
