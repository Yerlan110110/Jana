import uuid
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import OutboxMessage
from apps.hr_requests import services
from apps.integrations.serializers import ImportSnapshotSerializer


def employee_record(employee, **changes):
    record = {
        "external_id": employee.external_id,
        "full_name": employee.full_name,
        "position": employee.position,
        "department_code": employee.department.code,
        "manager_external_id": employee.manager.external_id if employee.manager_id else None,
        "hired_on": employee.hired_on.isoformat(),
        "leave_balance": str(employee.leave_balance),
        "balance_as_of": employee.balance_as_of.isoformat(),
        "locale": employee.locale,
        "is_active": employee.is_active,
        "incorporated_request_ids": [],
        "balance_reversals": [],
    }
    record.update(changes)
    return record


def source_batch(employee, *, revision=1, records=None, **changes):
    payload = {
        "source": "mock_1c",
        "legal_entity_id": str(employee.legal_entity_id),
        "source_revision": revision,
        "captured_at": timezone.now().isoformat(),
        "employees": records if records is not None else [employee_record(employee)],
    }
    payload.update(changes)
    return payload


def snapshot(payload):
    serializer = ImportSnapshotSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    return serializer.snapshot()


def post_import(user, payload, *, key=None):
    client = APIClient()
    client.force_authenticate(user)
    return client.post(
        "/api/v1/integrations/mock-1c/imports/",
        payload,
        format="json",
        HTTP_IDEMPOTENCY_KEY=key or str(uuid.uuid4()),
    )


def approved_request(employees, *, kind="leave", employee_key="employee", offset=20):
    employee = employees[employee_key]
    day = timezone.localdate() + timedelta(days=offset)
    data = {"kind": kind, "reason": "Synthetic integration test"}
    if kind == "leave":
        data.update(start_date=day, end_date=day + timedelta(days=2))
    else:
        data.update(amount="45000.50", currency="KZT", requested_payment_date=day)
        from decimal import Decimal

        data["amount"] = Decimal(data["amount"])
    request = services.create(employee.user, data)
    request = services.submit(employee.user, request.pk, request.version)
    if request.assigned_manager_id:
        request = services.decide(employee.manager.user, request.pk, request.version, "approve")
    request = services.decide(employees["hr"].user, request.pk, request.version, "approve")
    return request, OutboxMessage.objects.get(event__requesthistory__request=request)
