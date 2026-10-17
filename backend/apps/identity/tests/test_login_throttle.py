import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_login_attempt_limit_remains_active_within_a_session():
    client = APIClient(enforce_csrf_checks=True)
    token = client.get("/api/v1/auth/csrf/").data["csrf_token"]
    statuses = []
    for _ in range(11):
        response = client.post(
            "/api/v1/auth/login/",
            {"username": "unknown-synthetic-user", "password": "Incorrect-synthetic-password"},
            HTTP_X_CSRFTOKEN=token,
        )
        statuses.append(response.status_code)
    assert statuses == [401] * 10 + [429]
    assert response.data["code"] == "throttled"
    assert int(response["Retry-After"]) > 0
