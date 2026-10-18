from datetime import timedelta
from uuid import uuid4

import pytest
from django.db import transaction
from django.utils import timezone

from apps.core.events import emit
from apps.notifications.models import Notification
from apps.notifications.services import notify

pytestmark = pytest.mark.django_db


def test_notification_is_owned_and_mark_read_is_idempotent(api_client, employees):
    owner = employees["employee"].user
    with transaction.atomic():
        event = emit("example.created", "employee", employees["employee"].pk, {}, actor=owner)
        message = notify(
            owner, "example", "Title", "Body", "employee", employees["employee"].pk, event
        )
        same = notify(
            owner, "example", "Title", "Body", "employee", employees["employee"].pk, event
        )
    assert same.pk == message.pk
    api_client.force_authenticate(employees["manager"].user)
    assert api_client.get("/api/v1/notifications/").data["count"] == 0
    assert api_client.post(f"/api/v1/notifications/{message.pk}/read/").status_code == 404
    api_client.force_authenticate(owner)
    first = api_client.post(f"/api/v1/notifications/{message.pk}/read/")
    second = api_client.post(f"/api/v1/notifications/{message.pk}/read/")
    assert first.status_code == 200
    assert first.data["read_at"] == second.data["read_at"]
    assert Notification.objects.count() == 1
    assert first.data["request_status"] is None


def test_request_notification_preserves_event_status_after_later_decision(api_client, employees):
    api_client.force_authenticate(employees["employee"].user)
    item = api_client.post(
        "/api/v1/requests/",
        {
            "kind": "advance",
            "amount": "5000.00",
            "currency": "KZT",
            "requested_payment_date": str(timezone.localdate() + timedelta(days=8)),
            "reason": "Проверка исторического уведомления",
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    ).data
    submitted = api_client.post(
        f"/api/v1/requests/{item['id']}/submit/",
        {"expected_version": item["version"]},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    ).data
    first = api_client.get("/api/v1/notifications/").data["results"][0]
    assert first["request_status"] == "pending_manager"
    api_client.force_authenticate(employees["manager"].user)
    approved = api_client.post(
        f"/api/v1/requests/{item['id']}/approve/",
        {"expected_version": submitted["version"]},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert approved.data["status"] == "pending_hr"
    api_client.force_authenticate(employees["employee"].user)
    rows = api_client.get("/api/v1/notifications/").data["results"]
    assert {row["request_status"] for row in rows} == {"pending_manager", "pending_hr"}
    saved = api_client.post(f"/api/v1/notifications/{first['id']}/read/").data
    assert saved["request_status"] == "pending_manager"
    assert saved["body"] == first["body"]
    assert api_client.get(f"/api/v1/requests/{item['id']}/").data["status"] == "pending_hr"
    assert "event" not in saved and "payload" not in saved


def test_unrelated_notification_does_not_project_an_attached_request_status(api_client, employees):
    owner = employees["employee"].user
    with transaction.atomic():
        event = emit("hr_request.approved", "hr_request", uuid4(), {"status": "approved"}, actor=owner)
        notify(owner, "example", "Title", "Body", "employee", employees["employee"].pk, event)
    api_client.force_authenticate(owner)
    item = api_client.get("/api/v1/notifications/").data["results"][0]
    assert item["request_status"] is None
    assert item["body"] == "Body"
