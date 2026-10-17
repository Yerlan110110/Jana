from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import JsonResponse
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler as drf_exception_handler


class Conflict(APIException):
    status_code = 409
    default_detail = "The resource has changed. Refresh it before trying again."
    default_code = "conflict"


class DependencyUnavailable(APIException):
    status_code = 503
    default_detail = "A required service is unavailable."
    default_code = "dependency_unavailable"


def exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        from rest_framework.exceptions import ValidationError

        exc = ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    detail = response.data
    field_errors = detail if isinstance(detail, dict) and "detail" not in detail else {}
    message = (
        detail.get("detail", "The supplied data is invalid.")
        if isinstance(detail, dict)
        else "The supplied data is invalid."
    )
    response.data = {
        "code": getattr(exc, "default_code", "request_failed"),
        "message": str(message),
        "field_errors": field_errors,
        "request_id": getattr(context.get("request"), "request_id", None),
    }
    return response


def csrf_failure(request, reason=""):
    return JsonResponse(
        {
            "code": "csrf_failed",
            "message": "Refresh the CSRF token and retry the request.",
            "field_errors": {},
            "request_id": getattr(request, "request_id", None),
        },
        status=403,
    )
