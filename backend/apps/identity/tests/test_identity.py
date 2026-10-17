import pytest
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.identity.permissions import can_manage_employee

pytestmark = pytest.mark.django_db


def test_employee_and_manager_lists_have_distinct_scopes(api_client, employees):
    api_client.force_authenticate(employees["employee"].user)
    own = api_client.get("/api/v1/employees/")
    assert own.status_code == 200
    assert {row["id"] for row in own.data["results"]} == {str(employees["employee"].pk)}
    api_client.force_authenticate(employees["manager"].user)
    team = api_client.get("/api/v1/employees/")
    assert {row["id"] for row in team.data["results"]} == {
        str(employees[key].pk) for key in ["manager", "employee", "peer"]
    }
    denied = api_client.get(f"/api/v1/employees/{employees['other_team'].pk}/")
    assert denied.status_code == 404


def test_hr_cannot_view_other_legal_entity(api_client, employees):
    api_client.force_authenticate(employees["hr"].user)
    result = api_client.get("/api/v1/employees/")
    assert result.data["count"] == 6
    assert api_client.get(f"/api/v1/employees/{employees['other_entity'].pk}/").status_code == 404


def test_official_profile_has_no_write_api(api_client, employees):
    api_client.force_authenticate(employees["hr"].user)
    result = api_client.patch(
        f"/api/v1/employees/{employees['employee'].pk}/", {"leave_balance": "1000.00"}
    )
    assert result.status_code == 405
    employees["employee"].refresh_from_db()
    assert str(employees["employee"].leave_balance) == "24.00"


def test_manager_never_manages_own_record(employees):
    manager = employees["manager"]
    assert not can_manage_employee(manager.user, manager)
    assert can_manage_employee(manager.user, employees["employee"])
    assert not can_manage_employee(manager.user, employees["other_team"])


def test_cyclic_and_cross_entity_manager_relationships_are_rejected(employees):
    manager = employees["manager"]
    manager.manager = employees["employee"]
    with pytest.raises(ValidationError):
        manager.save()
    manager.manager = employees["other_entity"]
    with pytest.raises(ValidationError):
        manager.save()


def test_login_requires_csrf_and_rotates_token(employees):
    client = APIClient(enforce_csrf_checks=True)
    payload = {"username": "employee", "password": "Synthetic-test-password-42!"}
    assert client.post("/api/v1/auth/login/", payload, format="json").status_code == 403
    token = client.get("/api/v1/auth/csrf/").data["csrf_token"]
    response = client.post("/api/v1/auth/login/", payload, format="json", HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 200
    assert response.data["user"]["id"] == str(employees["employee"].user_id)
    assert response.data["csrf_token"] != token
    assert client.get("/api/v1/auth/me/").status_code == 200
    assert client.post("/api/v1/auth/logout/").status_code == 403
    assert (
        client.post(
            "/api/v1/auth/logout/", HTTP_X_CSRFTOKEN=response.data["csrf_token"]
        ).status_code
        == 204
    )
    assert client.get("/api/v1/auth/me/").status_code == 401


def test_login_rejects_role_mass_assignment(employees):
    client = APIClient()
    result = client.post(
        "/api/v1/auth/login/",
        {"username": "employee", "password": "Synthetic-test-password-42!", "role": "hr"},
    )
    assert result.status_code == 400
    assert "role" in result.data["field_errors"]
