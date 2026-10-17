import pytest
from django.test import override_settings
from rest_framework.test import APIClient


@override_settings(CORS_ALLOWED_ORIGINS=["http://localhost:3000"])
@pytest.mark.parametrize("method", ["POST", "PATCH"])
def test_configured_frontend_can_send_command_headers(method):
    response = APIClient().options(
        "/api/v1/requests/",
        HTTP_ORIGIN="http://localhost:3000",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD=method,
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS="content-type,x-csrftoken,idempotency-key",
    )
    assert response.status_code == 200
    assert response["Access-Control-Allow-Origin"] == "http://localhost:3000"
    assert response["Access-Control-Allow-Credentials"] == "true"
    allowed = {
        value.strip().lower() for value in response["Access-Control-Allow-Headers"].split(",")
    }
    assert {"content-type", "x-csrftoken", "idempotency-key"} <= allowed


@override_settings(CORS_ALLOWED_ORIGINS=["http://localhost:3000"])
def test_unknown_origin_is_not_granted_command_access():
    response = APIClient().options(
        "/api/v1/requests/",
        HTTP_ORIGIN="https://untrusted.example",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS="idempotency-key",
    )
    assert "Access-Control-Allow-Origin" not in response


@override_settings(CORS_ALLOWED_ORIGINS=["http://localhost:3000"])
def test_configured_frontend_can_read_request_and_receipt_headers():
    response = APIClient().get("/api/v1/health/", HTTP_ORIGIN="http://localhost:3000")
    exposed = {
        value.strip().lower() for value in response["Access-Control-Expose-Headers"].split(",")
    }
    assert {"idempotency-replayed", "x-request-id"} <= exposed
