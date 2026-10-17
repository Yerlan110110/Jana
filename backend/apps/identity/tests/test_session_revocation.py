import pytest
from rest_framework.test import APIClient

from apps.identity.models import User
from apps.notifications.services import notify

pytestmark = pytest.mark.django_db


def login_client(username="employee"):
    client = APIClient(enforce_csrf_checks=True)
    token = client.get("/api/v1/auth/csrf/").data["csrf_token"]
    result = client.post(
        "/api/v1/auth/login/",
        {"username": username, "password": "Synthetic-test-password-42!"},
        HTTP_X_CSRFTOKEN=token,
    )
    assert result.status_code == 200
    return client, result.data["csrf_token"]


@pytest.mark.parametrize("first_route", ["me", "notifications", "mark_read"])
def test_deactivated_profile_revokes_observed_session_everywhere(employees, first_route):
    employee = employees["employee"]
    notification = notify(
        employee.user,
        "synthetic.private",
        "Synthetic private notification",
        "This is only visible to an active employee.",
        "employee",
        employee.pk,
    )
    client, csrf = login_client()
    employee.is_active = False
    employee.save()
    if first_route == "mark_read":
        result = client.post(
            f"/api/v1/notifications/{notification.pk}/read/", HTTP_X_CSRFTOKEN=csrf
        )
    else:
        path = "/api/v1/auth/me/" if first_route == "me" else "/api/v1/notifications/"
        result = client.get(path)
    assert result.status_code == 401
    assert "Synthetic private notification" not in str(result.data)
    notification.refresh_from_db()
    assert notification.read_at is None
    employee.is_active = True
    employee.save()
    assert client.get("/api/v1/auth/me/").status_code == 401
    fresh, _ = login_client()
    assert fresh.get("/api/v1/auth/me/").status_code == 200


def test_missing_profile_cannot_keep_existing_session(employees):
    client, _ = login_client()
    employees["employee"].delete()
    assert client.get("/api/v1/notifications/").status_code == 401
    assert client.get("/api/v1/auth/me/").status_code == 401


def test_technical_superuser_does_not_require_employee_profile(employees):
    User.objects.create_superuser("technical", password="Synthetic-test-password-42!")
    client, _ = login_client("technical")
    response = client.get("/api/v1/auth/me/")
    assert response.status_code == 200
    assert response.data["employee"] is None
