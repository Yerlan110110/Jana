from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event

import pytest
from django.db import close_old_connections, connection, connections, transaction

from apps.core.models import OutboxMessage
from apps.identity.models import User
from apps.integrations.adapters import MockDocumentologAdapter, build_export
from apps.integrations.models import (
    DeliveryAttempt,
    DocumentExportReceipt,
    MockDocumentReceipt,
    SourceImportBatch,
)
from apps.integrations.worker import claim_next, process_once

from .helpers import approved_request, employee_record, post_import, source_batch

pytestmark = pytest.mark.django_db(transaction=True)


def run_race(operations):
    if connection.vendor != "postgresql":
        pytest.skip("This test requires PostgreSQL row locks and SKIP LOCKED.")
    barrier = Barrier(len(operations), timeout=10)

    def run(operation):
        close_old_connections()
        try:
            barrier.wait()
            return operation()
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=len(operations)) as executor:
        return list(executor.map(run, operations))


def test_two_workers_deliver_one_message_once(employees):
    _, message = approved_request(employees)
    results = run_race([process_once, process_once])
    assert sorted(results) == [False, True]
    assert MockDocumentReceipt.objects.count() == DocumentExportReceipt.objects.count() == 1
    assert DeliveryAttempt.objects.count() == 1
    message.refresh_from_db()
    assert message.status == "processed"


def test_two_receiver_calls_with_the_same_key_return_the_same_receipt(employees):
    _, message = approved_request(employees)
    document = build_export(message.pk)
    results = run_race(
        [
            lambda: MockDocumentologAdapter().deliver(document),
            lambda: MockDocumentologAdapter().deliver(document),
        ]
    )
    assert results[0] == results[1]
    assert MockDocumentReceipt.objects.count() == 1


def test_worker_skips_a_locked_message_and_claims_the_next(employees):
    if connection.vendor != "postgresql":
        pytest.skip("SKIP LOCKED must run on PostgreSQL.")
    _, first = approved_request(employees)
    _, second = approved_request(employees, employee_key="peer")
    held, release = Event(), Event()

    def hold_first():
        close_old_connections()
        try:
            with transaction.atomic():
                OutboxMessage.objects.select_for_update().get(pk=first.pk)
                held.set()
                assert release.wait(10)
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(hold_first)
        try:
            assert held.wait(10)
            claim = claim_next()
            assert claim.message_id == second.pk
        finally:
            release.set()
            future.result(timeout=10)


def test_concurrent_partial_manager_updates_cannot_create_a_cycle(employees, operator):
    first, second = employees["manager"], employees["other_manager"]
    first_batch = source_batch(
        first, revision=1, records=[employee_record(first, manager_external_id=second.external_id)]
    )
    second_batch = source_batch(
        second, revision=2, records=[employee_record(second, manager_external_id=first.external_id)]
    )

    def submit(payload):
        user = User.objects.get(pk=operator.pk)
        response = post_import(user, payload)
        return response.status_code

    results = run_race([lambda: submit(first_batch), lambda: submit(second_batch)])
    assert results.count(201) == 1
    assert any(status in {400, 409} for status in results)
    first.refresh_from_db()
    second.refresh_from_db()
    assert not (first.manager_id == second.pk and second.manager_id == first.pk)
    assert SourceImportBatch.objects.filter(status="accepted").count() == 1


def test_same_source_revision_concurrently_converges_to_one_audit(employees, operator):
    payload = source_batch(employees["employee"])

    def submit():
        response = post_import(User.objects.get(pk=operator.pk), payload)
        return response.status_code, response.data["batch"]["id"]

    results = run_race([submit, submit])
    assert sorted(status for status, _ in results) == [200, 201]
    assert results[0][1] == results[1][1]
    assert SourceImportBatch.objects.filter(status="accepted").count() == 1
