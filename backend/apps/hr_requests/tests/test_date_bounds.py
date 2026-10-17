from datetime import date
from uuid import uuid4

import pytest

from apps.core.models import DomainEvent, IdempotencyRecord
from apps.hr_requests.models import HRRequest

pytestmark = pytest.mark.django_db


def test_computed_leave_days_overflow_returns_field_error_without_writes(api_client, employees):
    api_client.force_authenticate(employees["employee"].user)
    response = api_client.post(
        "/api/v1/requests/",
        {"kind": "leave", "start_date": "2026-10-18", "end_date": "9999-12-31"},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert response.status_code == 400
    assert "end_date" in response.data["field_errors"]
    assert not HRRequest.objects.exists()
    assert not DomainEvent.objects.exists()
    assert not IdempotencyRecord.objects.exists()


def test_overflowing_edit_preserves_draft_and_event_history(api_client, employees):
    api_client.force_authenticate(employees["employee"].user)
    created = api_client.post(
        "/api/v1/requests/",
        {"kind": "leave", "start_date": "2026-10-18", "end_date": "2026-10-20"},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert created.status_code == 201
    before_events = DomainEvent.objects.count()
    before_receipts = IdempotencyRecord.objects.count()
    response = api_client.patch(
        f"/api/v1/requests/{created.data['id']}/",
        {"end_date": "9999-12-31", "expected_version": created.data["version"]},
        format="json",
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert response.status_code == 400
    assert "end_date" in response.data["field_errors"]
    record = HRRequest.objects.get(pk=created.data["id"])
    assert record.end_date == date(2026, 10, 20)
    assert record.version == created.data["version"]
    assert DomainEvent.objects.count() == before_events
    assert IdempotencyRecord.objects.count() == before_receipts
