from copy import deepcopy
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from django.utils import timezone

from apps.academy import services as learning_commands
from apps.academy.curriculum import curriculum
from apps.academy.models import Course
from apps.core.models import DomainEvent
from apps.hr_requests import services as request_commands
from apps.knowledge.models import AssistantAnswer
from apps.knowledge.services import escalate_answer
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db


def advance(employee):
    return request_commands.create(
        employee.user,
        {
            "kind": "advance",
            "reason": "Synthetic workbench scenario",
            "amount": Decimal("1000.00"),
            "currency": "KZT",
            "requested_payment_date": timezone.localdate() + timedelta(days=30),
        },
    )


def pending(employee):
    record = advance(employee)
    return request_commands.submit(employee.user, record.pk, record.version)


def knowledge_case(employee):
    answer = AssistantAnswer.objects.create(
        user=employee.user,
        client_message_id=uuid4(),
        question="Синтетический вопрос вне доступных правил",
        language="ru",
        mode=AssistantAnswer.Mode.INSUFFICIENT,
        reason="no_retrieval_support",
    )
    case, _ = escalate_answer(employee.user, answer.pk)
    return case


def published_course(hr, code):
    draft = deepcopy(curriculum()[0]["draft"])
    course = learning_commands.create_course(hr.user, code, draft)
    return learning_commands.publish_course(hr.user, course.pk, course.version)


def test_requires_authenticated_active_profile(api_client, employees):
    assert api_client.get("/api/v1/workbench/").status_code == 401
    employee = employees["employee"]
    api_client.force_authenticate(employee.user)
    employee.is_active = False
    employee.save()
    assert api_client.get("/api/v1/workbench/").status_code == 403


def test_scoped_preview_counts_and_no_read_side_effect(api_client, employees):
    employee = employees["employee"]
    for _ in range(4):
        advance(employee)
    advance(employees["other_team"])
    pending(employee)
    api_client.force_authenticate(employee.user)
    events = DomainEvent.objects.count()
    unread = Notification.objects.filter(recipient=employee.user, read_at__isnull=True).count()
    response = api_client.get("/api/v1/workbench/?preview_limit=2")
    assert response.status_code == 200
    data = response.json()
    assert data["employee"]["id"] == str(employee.pk)
    assert data["draft_requests"]["count"] == 4
    assert len(data["draft_requests"]["results"]) == 2
    assert {item["employee"] for item in data["draft_requests"]["results"]} == {str(employee.pk)}
    assert data["requests_to_review"]["count"] == 0
    assert data["waiting_request_count"] == 1
    assert data["unread_notification_count"] == unread
    assert data["learning_summary"]["total"] == 0
    assert data["learning_summary"]["completion_percent"] is None
    assert DomainEvent.objects.count() == events


def test_query_cannot_change_employee_scope_or_remove_limit(api_client, employees):
    api_client.force_authenticate(employees["employee"].user)
    for query in ["preview_limit=21", "preview_limit=0", f"employee={employees['peer'].pk}"]:
        assert api_client.get(f"/api/v1/workbench/?{query}").status_code == 400


def test_manager_review_uses_assigned_and_current_team(api_client, employees):
    own_team = pending(employees["employee"])
    pending(employees["other_team"])
    pending(employees["manager"])
    api_client.force_authenticate(employees["manager"].user)
    data = api_client.get("/api/v1/workbench/").json()
    assert data["requests_to_review"]["count"] == 1
    item = data["requests_to_review"]["results"][0]
    assert item["id"] == str(own_team.pk)
    assert "approve" in item["allowed_actions"]
    employee = employees["employee"]
    employee.manager = employees["other_manager"]
    employee.save()
    assert api_client.get("/api/v1/workbench/").json()["requests_to_review"]["count"] == 0
    api_client.force_authenticate(employees["other_manager"].user)
    result_ids = {
        row["id"]
        for row in api_client.get("/api/v1/workbench/").json()["requests_to_review"]["results"]
    }
    assert str(own_team.pk) not in result_ids


def test_hr_queue_respects_stage_entity_and_no_self_review(api_client, employees):
    employee_request = pending(employees["employee"])
    employee_request = request_commands.decide(
        employees["manager"].user,
        employee_request.pk,
        employee_request.version,
        "approve",
    )
    pending(employees["peer"])
    pending(employees["hr"])
    pending(employees["other_entity"])
    api_client.force_authenticate(employees["hr"].user)
    data = api_client.get("/api/v1/workbench/").json()
    assert data["requests_to_review"]["count"] == 1
    assert data["requests_to_review"]["results"][0]["id"] == str(employee_request.pk)
    assert data["waiting_request_count"] == 1


def test_learning_is_personal_and_due_and_availability_are_separate(api_client, employees):
    first = published_course(employees["hr"], "workbench-first")
    second = published_course(employees["hr"], "workbench-second")
    due = timezone.now() - timedelta(days=1)
    overdue = learning_commands.assign(
        employees["hr"].user,
        first.published_version_id,
        employees["employee"].pk,
        required=False,
        due_at=due,
    )
    learning_commands.assign(
        employees["hr"].user, second.published_version_id, employees["employee"].pk
    )
    learning_commands.assign(
        employees["hr"].user, first.published_version_id, employees["manager"].pk
    )
    api_client.force_authenticate(employees["employee"].user)
    data = api_client.get("/api/v1/workbench/").json()
    assert data["learning_summary"]["total"] == 2
    assert data["learning_summary"]["overdue"] == 1
    assert data["learning_outstanding"]["results"][0]["id"] == str(overdue.pk)
    assert "correct_option_id" not in str(data["learning_outstanding"])
    learning_commands.set_availability(
        employees["hr"].user, first.pk, first.version, Course.Availability.ARCHIVED
    )
    data = api_client.get("/api/v1/workbench/").json()
    assert data["learning_summary"]["total"] == 2
    assert data["learning_outstanding"]["count"] == 1
    assert data["unavailable_learning_count"] == 1
    api_client.force_authenticate(employees["manager"].user)
    assert api_client.get("/api/v1/workbench/").json()["learning_summary"]["total"] == 1


def test_private_hr_cases_never_enter_managers_team_workbench(api_client, employees):
    case = knowledge_case(employees["employee"])
    foreign = knowledge_case(employees["other_entity"])
    api_client.force_authenticate(employees["manager"].user)
    data = api_client.get("/api/v1/workbench/").json()
    assert data["open_knowledge_cases"]["count"] == 0
    assert data["knowledge_case_purpose"] == "track_own"
    api_client.force_authenticate(employees["hr"].user)
    data = api_client.get("/api/v1/workbench/").json()
    assert data["open_knowledge_cases"]["count"] == 1
    assert data["open_knowledge_cases"]["results"][0]["id"] == str(case.pk)
    assert str(foreign.pk) not in str(data)
    assert data["knowledge_case_purpose"] == "hr_response"


def test_returned_request_disappears_from_correction_queue_after_resubmit(api_client, employees):
    employee = employees["employee"]
    record = pending(employee)
    record = request_commands.decide(
        employees["manager"].user,
        record.pk,
        record.version,
        "return_for_changes",
        "Please clarify the synthetic reason.",
    )
    api_client.force_authenticate(employee.user)
    data = api_client.get("/api/v1/workbench/").json()
    assert data["returned_requests"]["count"] == 1
    request_commands.submit(employee.user, record.pk, record.version)
    data = api_client.get("/api/v1/workbench/").json()
    assert data["returned_requests"]["count"] == 0
    assert data["waiting_request_count"] == 1
