from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.db import close_old_connections, connection, connections
from rest_framework.test import APIClient

from apps.core.models import IdempotencyRecord, OutboxMessage
from apps.hr_requests import services
from apps.hr_requests.models import HRRequest, RequestRevision
from apps.identity.models import User

from .test_requests import leave_details

pytestmark = pytest.mark.django_db(transaction=True)


def concurrently_post(user_id, paths, payloads, keys):
    if connection.vendor != "postgresql":
        pytest.skip("This test proves PostgreSQL row-lock semantics; SQLite is not equivalent.")
    barrier = Barrier(len(paths), timeout=10)

    def run(arguments):
        path, payload, key = arguments
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(User.objects.get(pk=user_id))
            barrier.wait()
            result = client.post(path, payload, format="json", HTTP_IDEMPOTENCY_KEY=key)
            return result.status_code, result.data
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=len(paths)) as executor:
        return list(executor.map(run, zip(paths, payloads, keys, strict=True)))


def test_two_overlapping_submissions_reserve_leave_once(employees):
    owner = employees["employee"].user
    first = services.create(owner, leave_details())
    second = services.create(owner, leave_details(offset=11))
    results = concurrently_post(
        owner.pk,
        [f"/api/v1/requests/{item.pk}/submit/" for item in [first, second]],
        [{"expected_version": 1}] * 2,
        ["overlap-a", "overlap-b"],
    )
    assert sorted(status for status, _ in results) == [200, 409]
    assert HRRequest.objects.filter(status="pending_manager").count() == 1
    assert RequestRevision.objects.count() == 1


def test_two_final_decisions_create_one_export(employees):
    owner = employees["employee"].user
    item = services.create(owner, leave_details())
    item = services.submit(owner, item.pk, item.version)
    item = services.decide(employees["manager"].user, item.pk, item.version, "approve")
    results = concurrently_post(
        employees["hr"].user.pk,
        [f"/api/v1/requests/{item.pk}/approve/"] * 2,
        [{"expected_version": item.version}] * 2,
        ["approval-a", "approval-b"],
    )
    assert sorted(status for status, _ in results) == [200, 409]
    assert OutboxMessage.objects.count() == 1
    item.refresh_from_db()
    assert item.status == "approved" and item.version == 4


def test_same_idempotency_key_concurrently_creates_one_request(employees):
    results = concurrently_post(
        employees["employee"].user.pk,
        ["/api/v1/requests/"] * 2,
        [leave_details()] * 2,
        ["same-create"] * 2,
    )
    assert [status for status, _ in results] == [201, 201]
    assert results[0][1] == results[1][1]
    assert HRRequest.objects.count() == 1
    assert IdempotencyRecord.objects.filter(key="same-create").count() == 1
