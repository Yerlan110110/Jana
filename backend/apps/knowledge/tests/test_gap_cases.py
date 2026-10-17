import uuid
from unittest.mock import patch

import pytest
from django.core.cache import cache

from apps.core.models import DomainEvent, IdempotencyRecord
from apps.knowledge.models import KnowledgeGapCase
from apps.knowledge.services import ask_question, escalate_answer
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db


@pytest.fixture
def unsupported_answer(employees):
    cache.clear()
    answer, _ = ask_question(
        employees["employee"].user, "Как получить корпоративную ипотеку?", "ru", uuid.uuid4()
    )
    return answer


def test_explicit_escalation_replays_once_and_notifies_hr(
    api_client, employees, unsupported_answer
):
    assert KnowledgeGapCase.objects.count() == 0
    api_client.force_authenticate(employees["employee"].user)
    payload = {
        "answer_id": str(unsupported_answer.id),
        "details": "Нужна информация о доступных программах.",
    }
    first = api_client.post("/api/v1/knowledge/gaps/", payload, HTTP_IDEMPOTENCY_KEY="one-gap")
    assert first.status_code == 201
    again = api_client.post("/api/v1/knowledge/gaps/", payload, HTTP_IDEMPOTENCY_KEY="one-gap")
    assert again.status_code == 201
    assert again.data == first.data
    another_key = api_client.post(
        "/api/v1/knowledge/gaps/", payload, HTTP_IDEMPOTENCY_KEY="same-gap-another-key"
    )
    assert another_key.status_code == 200
    assert another_key.data["id"] == first.data["id"]
    assert KnowledgeGapCase.objects.count() == 1
    assert (
        Notification.objects.filter(
            recipient=employees["hr"].user, kind="knowledge_gap_opened"
        ).count()
        == 1
    )
    assert DomainEvent.objects.filter(event_type="knowledge.gap_opened").count() == 1
    assert not Notification.objects.filter(recipient=employees["manager"].user).exists()


def test_cases_are_private_to_employee_and_legal_entity_hr(
    api_client, employees, unsupported_answer
):
    case, _ = escalate_answer(employees["employee"].user, unsupported_answer.id)
    for key in ("peer", "manager", "other_entity"):
        api_client.force_authenticate(employees[key].user)
        assert api_client.get(f"/api/v1/knowledge/gaps/{case.id}/").status_code == 404
        assert api_client.get("/api/v1/knowledge/gaps/").data["count"] == 0
    api_client.force_authenticate(employees["hr"].user)
    assert api_client.get(f"/api/v1/knowledge/gaps/{case.id}/").status_code == 200
    assert api_client.get("/api/v1/knowledge/gaps/").data["count"] == 1


def test_hr_resolution_saves_response_version_and_notification(
    api_client, employees, unsupported_answer
):
    case, _ = escalate_answer(employees["employee"].user, unsupported_answer.id)
    api_client.force_authenticate(employees["employee"].user)
    url = f"/api/v1/knowledge/gaps/{case.id}/resolve/"
    payload = {
        "expected_version": 1,
        "response": "В демонстрационной базе такой программы нет. Уточняем сведения у владельца кадровых правил.",
    }
    assert (
        api_client.post(url, payload, HTTP_IDEMPOTENCY_KEY="deny-employee-resolve").status_code
        == 403
    )
    api_client.force_authenticate(employees["hr"].user)
    response = api_client.post(url, payload, HTTP_IDEMPOTENCY_KEY="resolve-once")
    assert response.status_code == 200
    assert response.data["status"] == "resolved"
    assert response.data["version"] == 2
    assert response.data["response"] == payload["response"]
    assert response.data["resolved_by"] == str(employees["hr"].user.id)
    assert api_client.post(url, payload, HTTP_IDEMPOTENCY_KEY="resolve-once").data == response.data
    assert api_client.post(url, payload, HTTP_IDEMPOTENCY_KEY="resolve-stale").status_code == 409
    assert (
        Notification.objects.filter(
            recipient=employees["employee"].user, kind="knowledge_gap_resolved"
        ).count()
        == 1
    )
    assert DomainEvent.objects.filter(event_type="knowledge.gap_resolved").count() == 1


def test_escalation_rejects_another_users_answer_and_client_owned_state(
    api_client, employees, unsupported_answer
):
    api_client.force_authenticate(employees["peer"].user)
    assert (
        api_client.post(
            "/api/v1/knowledge/gaps/",
            {"answer_id": str(unsupported_answer.id)},
            HTTP_IDEMPOTENCY_KEY="wrong-answer",
        ).status_code
        == 404
    )
    api_client.force_authenticate(employees["employee"].user)
    response = api_client.post(
        "/api/v1/knowledge/gaps/",
        {
            "answer_id": str(unsupported_answer.id),
            "employee": str(employees["peer"].id),
            "status": "resolved",
        },
        HTTP_IDEMPOTENCY_KEY="wrong-state",
    )
    assert response.status_code == 400
    assert not KnowledgeGapCase.objects.exists()


def test_notification_failure_rolls_back_case_event_and_receipt(
    api_client, employees, unsupported_answer
):
    api_client.force_authenticate(employees["employee"].user)
    with patch(
        "apps.knowledge.services.notify",
        side_effect=RuntimeError("Synthetic notification write failure"),
    ):
        with pytest.raises(RuntimeError, match="Synthetic notification write failure"):
            api_client.post(
                "/api/v1/knowledge/gaps/",
                {"answer_id": str(unsupported_answer.id)},
                HTTP_IDEMPOTENCY_KEY="rollback-gap",
            )
    assert not KnowledgeGapCase.objects.exists()
    assert not DomainEvent.objects.filter(event_type="knowledge.gap_opened").exists()
    assert not IdempotencyRecord.objects.filter(key="rollback-gap").exists()


def test_case_keeps_original_entity_after_employee_transfer(
    api_client, employees, unsupported_answer
):
    case, _ = escalate_answer(employees["employee"].user, unsupported_answer.id)
    employee = employees["employee"]
    employee.manager = None
    employee.legal_entity = employees["other_entity"].legal_entity
    employee.department = employees["other_entity"].department
    employee.save()
    api_client.force_authenticate(employees["hr"].user)
    assert api_client.get(f"/api/v1/knowledge/gaps/{case.id}/").status_code == 200
    original_entity = str(employees["hr"].legal_entity_id)
    assert (
        str(api_client.get(f"/api/v1/knowledge/gaps/{case.id}/").data["legal_entity"])
        == original_entity
    )
