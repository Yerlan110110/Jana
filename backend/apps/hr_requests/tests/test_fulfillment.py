import pytest

from apps.integrations.tests.helpers import approved_request

pytestmark = pytest.mark.django_db


def test_employee_fulfillment_keeps_approval_delivery_and_source_independent(api_client, employees):
    request, _ = approved_request(employees)
    api_client.force_authenticate(employees["employee"].user)
    response = api_client.get(f"/api/v1/requests/{request.pk}/fulfillment/")
    assert response.status_code == 200
    data = response.json()
    assert data["approval"]["status"] == "approved"
    assert data["approval"]["submitted_revision_id"] == str(request.revisions.get(number=1).pk)
    assert data["delivery"] == {"state": "queued", "accepted_at": None}
    assert data["source_accounting"]["state"] == "not_confirmed"
    assert data["source_accounting"]["source_revision"] is None


@pytest.fixture
def operator(employees, settings):
    from django.contrib.auth.models import Permission

    settings.INTEGRATIONS_ALLOW_MOCK_FAULTS = True
    user = employees["hr"].user
    user.user_permissions.add(
        Permission.objects.get(
            content_type__app_label="integrations", codename="operate_integrations"
        )
    )
    return user


@pytest.mark.django_db(transaction=True)
def test_fulfillment_tracks_failure_retry_receipt_and_separate_source_confirmation(
    api_client, employees, operator
):
    from datetime import timedelta

    from apps.integrations.services import configure_mock_fault, retry_export
    from apps.integrations.tests.helpers import employee_record, post_import, source_batch
    from apps.integrations.worker import claim_next, deliver_claim, process_once

    request, message = approved_request(employees)
    api_client.force_authenticate(employees["employee"].user)
    url = f"/api/v1/requests/{request.pk}/fulfillment/"
    configure_mock_fault(
        operator, message.pk, message.version, transient_failures=1, permanent_failure=False
    )
    assert process_once()
    message.refresh_from_db()
    data = api_client.get(url).json()
    assert data["approval"]["status"] == "approved"
    assert data["delivery"]["state"] == "queued"
    assert data["source_accounting"]["state"] == "not_confirmed"
    configure_mock_fault(
        operator, message.pk, message.version, transient_failures=0, permanent_failure=True
    )
    claim = claim_next(now=message.available_at + timedelta(seconds=1))
    assert deliver_claim(claim)
    message.refresh_from_db()
    failed = api_client.get(url).json()
    assert failed["delivery"] == {"state": "needs_operator", "accepted_at": None}
    assert failed["approval"] == data["approval"]
    configure_mock_fault(
        operator, message.pk, message.version, transient_failures=0, permanent_failure=False
    )
    message.refresh_from_db()
    retry_export(operator, message.pk, message.version)
    assert process_once()
    accepted = api_client.get(url).json()
    assert accepted["delivery"]["state"] == "accepted"
    assert accepted["delivery"]["accepted_at"] is not None
    assert accepted["source_accounting"]["state"] == "not_confirmed"
    balance = api_client.get("/api/v1/requests/leave-balance/").json()
    assert balance["official_balance"] == "24.00"
    assert balance["portal_reserved_days"] == "3.00"
    assert balance["projected_balance"] == "21.00"
    employee = employees["employee"]
    payload = source_batch(
        employee,
        records=[
            employee_record(
                employee, leave_balance="21.00", incorporated_request_ids=[str(request.pk)]
            )
        ],
    )
    assert post_import(operator, payload).status_code == 201
    incorporated = api_client.get(url).json()
    assert incorporated["approval"] == accepted["approval"]
    assert incorporated["delivery"] == accepted["delivery"]
    assert incorporated["source_accounting"]["state"] == "incorporated"
    assert incorporated["source_accounting"]["source_revision"] == 1
    balance = api_client.get("/api/v1/requests/leave-balance/").json()
    assert balance["official_balance"] == "21.00"
    assert balance["portal_reserved_days"] == "0.00"
    assert balance["projected_balance"] == "21.00"
    reversal = source_batch(
        employee,
        revision=2,
        records=[
            employee_record(
                employee,
                leave_balance="24.00",
                balance_reversals=[
                    {"request_id": str(request.pk), "reason": "Synthetic source correction"}
                ],
            )
        ],
    )
    assert post_import(operator, reversal).status_code == 201
    reversed_evidence = api_client.get(url).json()
    assert reversed_evidence["delivery"] == accepted["delivery"]
    assert reversed_evidence["source_accounting"]["state"] == "reversed"
    assert reversed_evidence["source_accounting"]["source_revision"] == 2
    balance = api_client.get("/api/v1/requests/leave-balance/").json()
    assert balance["projected_balance"] == "21.00"


@pytest.mark.parametrize(
    "actor,expected",
    [
        ("employee", 200),
        ("manager", 200),
        ("hr", 200),
        ("peer", 404),
        ("other_manager", 404),
        ("other_entity", 404),
    ],
)
def test_fulfillment_has_request_scope_without_operator_data(
    api_client, employees, actor, expected
):
    from apps.core.models import DomainEvent, OutboxMessage
    from apps.notifications.models import Notification

    request, _ = approved_request(employees)
    api_client.force_authenticate(employees[actor].user)
    before = (
        DomainEvent.objects.count(),
        OutboxMessage.objects.count(),
        Notification.objects.count(),
    )
    response = api_client.get(f"/api/v1/requests/{request.pk}/fulfillment/")
    assert response.status_code == expected
    if expected == 200:
        data = response.json()
        assert set(data) == {"request_id", "approval", "delivery", "source_accounting"}
        assert set(data["approval"]) == {"status", "submitted_revision_id", "submission_number"}
        assert set(data["delivery"]) == {"state", "accepted_at"}
        assert set(data["source_accounting"]) == {
            "state",
            "source_revision",
            "confirmed_at",
            "balance_as_of",
        }
        assert "retry" not in str(data)
    assert (
        DomainEvent.objects.count(),
        OutboxMessage.objects.count(),
        Notification.objects.count(),
    ) == before


@pytest.mark.django_db(transaction=True)
def test_advance_fulfillment_does_not_claim_payment_or_source_balance(api_client, employees):
    from apps.integrations.worker import process_once

    request, _ = approved_request(employees, kind="advance")
    assert process_once()
    api_client.force_authenticate(employees["employee"].user)
    data = api_client.get(f"/api/v1/requests/{request.pk}/fulfillment/").json()
    assert data["delivery"]["state"] == "accepted"
    assert data["source_accounting"] == {
        "state": "not_applicable",
        "source_revision": None,
        "confirmed_at": None,
        "balance_as_of": None,
    }
    assert "paid" not in str(data)
    assert "signed" not in str(data)


def test_draft_fulfillment_is_not_queued_and_writes_are_denied(api_client, employees):
    from .test_requests import create_via_api

    created = create_via_api(api_client, employees["employee"]).json()
    url = f"/api/v1/requests/{created['id']}/fulfillment/"
    data = api_client.get(url).json()
    assert data["approval"] == {
        "status": "draft",
        "submitted_revision_id": None,
        "submission_number": 0,
    }
    assert data["delivery"] == {"state": "not_queued", "accepted_at": None}
    assert data["source_accounting"]["state"] == "not_confirmed"
    assert api_client.post(url, {"state": "accepted"}).status_code == 405
    employees["employee"].is_active = False
    employees["employee"].save()
    assert api_client.get(url).status_code == 404
