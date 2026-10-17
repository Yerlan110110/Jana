import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.db import connection, connections
from rest_framework.test import APIClient

from apps.core.models import DomainEvent
from apps.knowledge.models import KnowledgeGapCase
from apps.knowledge.services import ask_question, escalate_answer
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db(transaction=True)


def race_post(user, url, payload, prefix):
    if connection.vendor != "postgresql":
        pytest.skip("Row-lock behavior requires PostgreSQL.")
    barrier = Barrier(2)

    def worker(number):
        connections.close_all()
        try:
            client = APIClient()
            client.force_authenticate(user)
            barrier.wait(timeout=10)
            response = client.post(url, payload, HTTP_IDEMPOTENCY_KEY=f"{prefix}-{number}")
            return response.status_code, response.data
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        return list(pool.map(worker, [1, 2]))


def test_concurrent_publish_creates_one_immutable_revision(employees, make_policy):
    document = make_policy(publish=False)
    results = race_post(
        employees["hr"].user,
        f"/api/v1/knowledge/admin/documents/{document.id}/publish/",
        {"expected_version": document.version},
        "publish-race",
    )
    assert sorted(status for status, _ in results) == [200, 409]
    assert document.revisions.count() == 1
    assert (
        DomainEvent.objects.filter(
            event_type="knowledge.revision_published", aggregate_id=document.id
        ).count()
        == 1
    )


def test_concurrent_escalation_creates_one_case_and_one_hr_notification(employees):
    answer, _ = ask_question(
        employees["employee"].user, "Как получить корпоративную ипотеку?", "ru", uuid.uuid4()
    )
    results = race_post(
        employees["employee"].user,
        "/api/v1/knowledge/gaps/",
        {"answer_id": str(answer.id)},
        "escalate-race",
    )
    assert sorted(status for status, _ in results) == [200, 201]
    assert KnowledgeGapCase.objects.filter(answer=answer).count() == 1
    assert Notification.objects.filter(kind="knowledge_gap_opened").count() == 1


def test_concurrent_resolution_preserves_one_response(employees):
    answer, _ = ask_question(
        employees["employee"].user, "Как получить корпоративную ипотеку?", "ru", uuid.uuid4()
    )
    case, _ = escalate_answer(employees["employee"].user, answer.id)
    results = race_post(
        employees["hr"].user,
        f"/api/v1/knowledge/gaps/{case.id}/resolve/",
        {"expected_version": 1, "response": "Синтетический ответ HR сохранен в обращении."},
        "resolve-race",
    )
    assert sorted(status for status, _ in results) == [200, 409]
    case.refresh_from_db()
    assert case.version == 2
    assert case.status == "resolved"
    assert Notification.objects.filter(kind="knowledge_gap_resolved").count() == 1
