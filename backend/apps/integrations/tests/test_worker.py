from dataclasses import replace
from datetime import timedelta
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import transaction
from django.utils import timezone

from apps.core.errors import Conflict
from apps.core.models import DomainEvent, OutboxMessage
from apps.hr_requests.models import RequestHistory
from apps.identity.models import User
from apps.integrations.adapters import MockDocumentologAdapter, build_export
from apps.integrations.contracts import DeliveryFailure
from apps.integrations.models import (
    DeliveryAttempt,
    DeliveryAttemptResult,
    DocumentExportReceipt,
    MockDeliveryFault,
    MockDocumentReceipt,
)
from apps.integrations.services import configure_mock_fault, retry_export
from apps.integrations.worker import (
    MAX_CYCLE_ATTEMPTS,
    acknowledge,
    claim_next,
    deliver_claim,
    process_once,
    record_failure,
)
from apps.notifications.models import Notification

from .helpers import approved_request, employee_record, post_import, source_batch

pytestmark = pytest.mark.django_db(transaction=True)


def test_export_uses_immutable_submitted_facts_after_source_changes(employees, operator):
    request, message = approved_request(employees)
    original_name = request.employee.full_name
    payload = source_batch(
        request.employee,
        records=[employee_record(request.employee, full_name="Synthetic new source name")],
    )
    assert post_import(operator, payload).status_code == 201
    before_history = RequestHistory.objects.count()
    assert process_once() is True
    message.refresh_from_db()
    remote = MockDocumentReceipt.objects.get()
    assert remote.payload["submitted"]["employee_name"] == original_name
    assert remote.payload["submitted"]["employee_external_id"] == request.employee.external_id
    assert remote.payload["submitted"]["leave_days"] == "3.00"
    assert "password" not in str(remote.payload).lower()
    assert message.status == "processed" and message.processed_at
    assert message.claim_token is None and message.lease_expires_at is None
    assert message.export_receipt.document_id == remote.document_id
    assert RequestHistory.objects.count() == before_history
    assert not process_once()
    assert MockDocumentReceipt.objects.count() == DocumentExportReceipt.objects.count() == 1
    assert Notification.objects.filter(kind="integration_receipt").count() == 1


def test_salary_advance_exports_exact_decimal_without_claiming_payment(employees):
    request, message = approved_request(employees, kind="advance")
    assert process_once()
    remote = MockDocumentReceipt.objects.get()
    assert remote.payload["submitted"]["amount"] == "45000.50"
    assert remote.payload["submitted"]["currency"] == "KZT"
    assert "paid" not in remote.payload and "signed" not in remote.payload
    request.refresh_from_db()
    assert request.status == "approved"


def test_transient_failure_preserves_approval_and_retries_same_identity(employees, operator):
    request, message = approved_request(employees)
    configure_mock_fault(
        operator, message.pk, message.version, transient_failures=1, permanent_failure=False
    )
    assert process_once()
    message.refresh_from_db()
    assert message.status == "pending" and message.attempt_count == 1
    assert message.available_at > timezone.now()
    assert not process_once()
    assert not DocumentExportReceipt.objects.exists()
    fault = MockDeliveryFault.objects.get(outbox=message)
    assert fault.transient_failures_remaining == 0
    claim = claim_next(now=message.available_at + timedelta(seconds=1))
    assert deliver_claim(claim)
    message.refresh_from_db()
    request.refresh_from_db()
    assert message.status == "processed" and message.attempt_count == 2
    assert request.status == "approved"
    assert MockDocumentReceipt.objects.get().idempotency_key == f"janamen-documentolog-{message.pk}"
    assert list(
        DeliveryAttemptResult.objects.order_by("attempt__number").values_list("outcome", flat=True)
    ) == ["retry_scheduled", "accepted"]


def test_permanent_failure_needs_explicit_operator_retry(employees, operator):
    request, message = approved_request(employees)
    configure_mock_fault(
        operator, message.pk, message.version, transient_failures=0, permanent_failure=True
    )
    assert process_once()
    message.refresh_from_db()
    assert message.status == "failed" and message.attempt_count == 1
    assert Notification.objects.filter(recipient=operator, kind="integration_failure").count() == 1
    assert not process_once()
    message = configure_mock_fault(
        operator, message.pk, message.version, transient_failures=0, permanent_failure=False
    )
    message = retry_export(operator, message.pk, message.version)
    assert message.attempt_count == 1 and message.cycle_attempt_count == 0
    assert process_once()
    message.refresh_from_db()
    assert message.status == "processed" and message.attempt_count == 2
    assert MockDocumentReceipt.objects.count() == 1
    with pytest.raises(Conflict):
        retry_export(operator, message.pk, message.version)
    assert RequestHistory.objects.filter(request=request, to_status="approved").count() == 1


def test_automatic_retry_cycle_is_bounded_and_manual_retry_preserves_history(employees, operator):
    _, message = approved_request(employees)
    configure_mock_fault(
        operator, message.pk, message.version, transient_failures=10, permanent_failure=False
    )
    for number in range(1, MAX_CYCLE_ATTEMPTS + 1):
        message.refresh_from_db()
        claim = claim_next(now=max(timezone.now(), message.available_at) + timedelta(seconds=1))
        assert deliver_claim(claim)
        message.refresh_from_db()
        assert message.attempt_count == number
    assert message.status == "failed" and message.cycle_attempt_count == MAX_CYCLE_ATTEMPTS
    assert "Automatic retries are exhausted" in message.last_error
    assert not process_once()
    message = retry_export(operator, message.pk, message.version)
    assert message.cycle_attempt_count == 0 and message.attempt_count == MAX_CYCLE_ATTEMPTS
    assert DeliveryAttempt.objects.filter(outbox=message).count() == MAX_CYCLE_ATTEMPTS


def test_crash_after_receiver_acceptance_reuses_receipt_and_fences_old_worker(employees):
    _, message = approved_request(employees)
    first = claim_next()
    document = build_export(message.pk)
    adapter = MockDocumentologAdapter()
    receipt = adapter.deliver(document)
    assert MockDocumentReceipt.objects.count() == 1
    assert not DocumentExportReceipt.objects.exists()
    message.refresh_from_db()
    second = claim_next(now=message.lease_expires_at + timedelta(seconds=1))
    assert second is not None and second.token != first.token
    assert not acknowledge(first, document, receipt)
    assert not record_failure(
        first,
        DeliveryFailure("old_worker", "Old worker cannot change the result.", retryable=False),
    )
    second_receipt = adapter.deliver(build_export(message.pk))
    assert receipt == second_receipt
    assert acknowledge(second, document, second_receipt)
    message.refresh_from_db()
    assert message.status == "processed" and message.attempt_count == 2
    assert MockDocumentReceipt.objects.count() == DocumentExportReceipt.objects.count() == 1
    assert DeliveryAttemptResult.objects.get(attempt_id=first.attempt_id).outcome == "lease_expired"
    assert DeliveryAttemptResult.objects.get(attempt_id=second.attempt_id).outcome == "accepted"


def test_expired_unreclaimed_worker_cannot_acknowledge(employees):
    _, message = approved_request(employees)
    claim = claim_next()
    document = build_export(message.pk)
    receipt = MockDocumentologAdapter().deliver(document)
    message.refresh_from_db()
    assert not acknowledge(claim, document, receipt, now=message.lease_expires_at)
    assert not DocumentExportReceipt.objects.exists()


def test_repeated_worker_crashes_eventually_require_operator_action(employees, operator):
    _, message = approved_request(employees)
    claim = claim_next()
    for _ in range(MAX_CYCLE_ATTEMPTS):
        message.refresh_from_db()
        claim = claim_next(now=message.lease_expires_at + timedelta(seconds=1))
    assert claim is None
    message.refresh_from_db()
    assert message.status == "failed" and message.attempt_count == MAX_CYCLE_ATTEMPTS
    assert message.failure_code == "worker_claims_exhausted"
    assert (
        DeliveryAttemptResult.objects.filter(outcome="lease_expired").count() == MAX_CYCLE_ATTEMPTS
    )


def test_local_acknowledgment_failure_rolls_back_but_receiver_receipt_survives(employees):
    _, message = approved_request(employees)
    with (
        patch(
            "apps.integrations.worker.notify",
            side_effect=RuntimeError("synthetic database failure"),
        ),
        pytest.raises(RuntimeError),
    ):
        process_once()
    message.refresh_from_db()
    assert message.status == "processing"
    assert MockDocumentReceipt.objects.count() == 1
    assert not DocumentExportReceipt.objects.exists()
    assert not DomainEvent.objects.filter(event_type="integration.export_accepted").exists()
    next_claim = claim_next(now=message.lease_expires_at + timedelta(seconds=1))
    assert deliver_claim(next_claim)
    assert MockDocumentReceipt.objects.count() == DocumentExportReceipt.objects.count() == 1


def test_receiver_rejects_different_payload_under_same_key(employees):
    _, message = approved_request(employees)
    document = build_export(message.pk)
    adapter = MockDocumentologAdapter()
    original = adapter.deliver(document)
    changed = replace(document, payload={**document.payload, "forged": True})
    with pytest.raises(DeliveryFailure, match="different data"):
        adapter.deliver(changed)
    assert MockDocumentReceipt.objects.get().document_id == original.document_id
    assert "forged" not in MockDocumentReceipt.objects.get().payload


def test_receipt_with_invalid_identity_is_not_reported_as_delivered(employees):
    _, message = approved_request(employees)

    class WrongReceiptAdapter:
        def deliver(self, document):
            receipt = MockDocumentologAdapter().deliver(document)
            return replace(receipt, payload_hash="0" * 64)

    assert process_once(adapter=WrongReceiptAdapter())
    message.refresh_from_db()
    assert message.status == "failed" and message.failure_code == "invalid_provider_receipt"
    assert not DocumentExportReceipt.objects.exists()


def test_unexpected_provider_exception_does_not_expose_secret_text(employees):
    _, message = approved_request(employees)

    class BrokenAdapter:
        def deliver(self, document):
            raise RuntimeError("secret-provider-key=SYNTHETIC-SHOULD-NOT-LEAK")

    assert process_once(adapter=BrokenAdapter())
    message.refresh_from_db()
    assert message.status == "pending"
    assert "SHOULD-NOT-LEAK" not in message.last_error
    assert message.failure_code == "provider_execution_failed"


def test_delivery_cannot_run_inside_business_transaction(employees):
    approved_request(employees)
    with transaction.atomic(), pytest.raises(RuntimeError, match="outside"):
        process_once()
    assert not MockDocumentReceipt.objects.exists()


def test_unknown_topic_records_a_permanent_failure(employees):
    _, message = approved_request(employees)
    message.topic = "unconfigured_topic"
    message.save()
    assert process_once()
    message.refresh_from_db()
    assert message.status == "failed" and message.failure_code == "unsupported_topic"


def test_worker_cli_processes_due_messages_and_watch_limit_exits(employees):
    approved_request(employees)
    output = StringIO()
    call_command("process_outbox", watch=True, max_messages=1, stdout=output)
    assert "Outbox messages attempted: 1" in output.getvalue()
    assert OutboxMessage.objects.get().status == "processed"
    empty = StringIO()
    call_command("process_outbox", stdout=empty)
    assert "Outbox messages attempted: 0" in empty.getvalue()
    with pytest.raises(CommandError):
        call_command("process_outbox", poll_interval=0)


def test_operator_export_api_includes_recoverable_states_and_exact_receipt(
    employees, operator, api_client
):
    request, message = approved_request(employees)
    api_client.force_authenticate(operator)
    path = f"/api/v1/integrations/exports/{message.pk}/"
    initial = api_client.get(path)
    assert initial.status_code == 200 and initial.data["delivery_status"] == "pending"
    assert initial.data["mock_fault_available"] is True
    assert initial.data["allowed_actions"] == [] and initial.data["export_receipt"] is None
    fault = api_client.post(
        f"{path}mock-fault/",
        {"expected_version": message.version, "permanent_failure": True},
        format="json",
        HTTP_IDEMPOTENCY_KEY="demo-fault",
    )
    assert fault.status_code == 200
    assert process_once()
    failed = api_client.get(path)
    assert failed.data["delivery_status"] == "failed" and failed.data["allowed_actions"] == [
        "retry"
    ]
    clear = api_client.post(
        f"{path}mock-fault/",
        {"expected_version": failed.data["version"]},
        format="json",
        HTTP_IDEMPOTENCY_KEY="clear-fault",
    )
    response = api_client.post(
        f"{path}retry/",
        {"expected_version": clear.data["version"]},
        format="json",
        HTTP_IDEMPOTENCY_KEY="retry-export",
    )
    again = api_client.post(
        f"{path}retry/",
        {"expected_version": clear.data["version"]},
        format="json",
        HTTP_IDEMPOTENCY_KEY="retry-export",
    )
    assert response.status_code == again.status_code == 200 and response.data == again.data
    assert process_once()
    received = api_client.get(path)
    assert received.data["delivery_status"] == "processed"
    assert received.data["mock_fault_available"] is False
    assert received.data["export_receipt"]["acceptance_meaning"] == "document_received_only"
    assert len(received.data["delivery_attempts"]) == 2
    assert str(request.pk) == str(received.data["request_id"])


def test_export_read_and_retry_deny_employee_manager_and_other_entity(
    employees, operator, api_client
):
    _, message = approved_request(employees)
    path = f"/api/v1/integrations/exports/{message.pk}/"
    for key in ["employee", "manager", "other_team", "other_entity"]:
        api_client.force_authenticate(employees[key].user)
        assert api_client.get(path).status_code == 403
        assert (
            api_client.post(
                f"{path}retry/",
                {"expected_version": 1},
                format="json",
                HTTP_IDEMPOTENCY_KEY=f"deny-{key}",
            ).status_code
            == 403
        )
    hr_employee = employees["hr"]
    hr_employee.legal_entity = employees["other_entity"].legal_entity
    hr_employee.department = employees["other_entity"].department
    hr_employee.save()
    api_client.force_authenticate(User.objects.get(pk=operator.pk))
    assert api_client.get(path).status_code == 404
    assert api_client.get("/api/v1/integrations/exports/").data["count"] == 0


def test_mock_controls_can_be_disabled_without_disabling_real_reads(
    employees, operator, api_client, settings
):
    _, message = approved_request(employees)
    settings.INTEGRATIONS_ALLOW_MOCK_FAULTS = False
    api_client.force_authenticate(operator)
    path = f"/api/v1/integrations/exports/{message.pk}/"
    read = api_client.get(path)
    assert read.status_code == 200
    assert read.data["mock_fault_available"] is False
    denied = api_client.post(
        f"{path}mock-fault/",
        {"expected_version": 1, "transient_failures": 1},
        format="json",
        HTTP_IDEMPOTENCY_KEY="disabled-fault",
    )
    assert denied.status_code == 403
