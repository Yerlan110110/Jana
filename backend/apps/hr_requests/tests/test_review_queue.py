from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.hr_requests import services

pytestmark = pytest.mark.django_db


def pending(employee):
    record = services.create(
        employee.user,
        {
            "kind": "advance",
            "reason": "Synthetic review queue",
            "amount": Decimal("1000.00"),
            "currency": "KZT",
            "requested_payment_date": timezone.localdate() + timedelta(days=10),
        },
    )
    return services.submit(employee.user, record.pk, record.version)


def test_action_queue_filters_before_pagination_and_matches_workbench(api_client, employees):
    expected = {str(pending(employees["employee"]).pk) for _ in range(23)}
    pending(employees["manager"])
    pending(employees["other_team"])
    pending(employees["other_entity"])
    api_client.force_authenticate(employees["manager"].user)
    summary = api_client.get("/api/v1/workbench/?preview_limit=20").data["requests_to_review"]
    assert summary["count"] == 23
    url = "/api/v1/requests/?needs_my_action=true&page_size=5&ordering=submitted_at"
    found = []
    while url:
        response = api_client.get(url)
        assert response.status_code == 200
        assert response.data["count"] == 23
        found.extend(item["id"] for item in response.data["results"])
        assert all("approve" in item["allowed_actions"] for item in response.data["results"])
        url = response.data["next"]
    assert len(found) == 23
    assert set(found) == expected


@pytest.mark.parametrize("actor", ["employee", "manager", "hr", "admin"])
def test_action_queue_role_scope_and_filters(api_client, employees, actor):
    first = pending(employees["employee"])
    second = pending(employees["peer"])
    services.decide(employees["manager"].user, second.pk, second.version, "approve")
    pending(employees["hr"])
    pending(employees["other_team"])
    pending(employees["other_entity"])
    user = employees["peer"].user if actor == "admin" else employees[actor].user
    if actor == "admin":
        user.is_superuser = True
        user.save()
    api_client.force_authenticate(user)
    summary = api_client.get("/api/v1/workbench/?preview_limit=20").data["requests_to_review"]
    response = api_client.get("/api/v1/requests/?needs_my_action=true&page_size=100")
    assert response.status_code == 200
    assert response.data["count"] == summary["count"]
    expected = {row["id"] for row in summary["results"]}
    assert {row["id"] for row in response.data["results"]} == expected
    assert all("approve" in row["allowed_actions"] for row in response.data["results"])
    regular = api_client.get("/api/v1/requests/").data
    assert api_client.get("/api/v1/requests/?needs_my_action=false").data == regular
    combined = api_client.get(
        f"/api/v1/requests/?needs_my_action=true&kind=advance&status=pending_manager"
        f"&employee={employees['employee'].pk}&search=Synthetic&page_size=1"
    ).data
    selected = {str(first.pk)} & expected
    assert combined["count"] == len(selected)
    assert {row["id"] for row in combined["results"]} == selected


def test_action_queue_rechecks_team_and_active_profile(api_client, employees):
    record = pending(employees["employee"])
    api_client.force_authenticate(employees["manager"].user)
    url = "/api/v1/requests/?needs_my_action=true"
    assert api_client.get(url).data["count"] == 1
    employee = employees["employee"]
    employee.manager = employees["other_manager"]
    employee.save()
    assert api_client.get(url).data["count"] == 0
    assert api_client.get(f"/api/v1/requests/{record.pk}/").status_code == 404
    api_client.force_authenticate(employees["other_manager"].user)
    assert api_client.get(url).data["count"] == 0
    employee.manager = employees["manager"]
    employee.is_active = False
    employee.save()
    api_client.force_authenticate(employees["manager"].user)
    assert api_client.get(url).data["count"] == 0
    employee.is_active = True
    employee.save()
    manager = employees["manager"]
    manager.is_active = False
    manager.save()
    assert api_client.get(url).data["count"] == 0
