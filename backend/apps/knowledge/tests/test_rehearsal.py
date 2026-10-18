import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.core.models import DomainEvent
from apps.identity.models import Department, Employee, User
from apps.knowledge.models import (
    AssistantAnswer,
    KnowledgeChunk,
    KnowledgeGapCase,
    KnowledgeRevision,
)
from apps.knowledge.services import (
    ask_question,
    create_document,
    escalate_answer,
    publish_document,
    update_document,
)
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db

URL = "/api/v1/knowledge/admin/documents/{}/rehearsal/"


def _gap_case(employee, question="Как подать заявку на отпуск?"):
    answer, _ = ask_question(employee.user, question, "ru", uuid.uuid4())
    case, _ = escalate_answer(employee.user, answer.id)
    return case


def _foreign_hr(employees):
    entity = employees["other_entity"].legal_entity
    department = Department.objects.create(code="HR", name="HR KG", legal_entity=entity)
    user = User.objects.create_user(
        username="foreign_hr", password="Synthetic-test-password-42!", role="hr"
    )
    return Employee.objects.create(
        user=user,
        external_id="SYN-foreign-hr",
        full_name="Synthetic foreign HR",
        position="hr",
        legal_entity=entity,
        department=department,
        hired_on=date(2024, 1, 10),
        leave_balance=Decimal("24.00"),
        balance_as_of=date(2026, 10, 17),
    )


def test_rehearsal_previews_draft_scope_narrowing_as_lost(api_client, employees, make_policy):
    document = make_policy()
    case = _gap_case(employees["employee"])
    document = update_document(
        employees["hr"].user, document.id, document.version, {"audience": "hr"}
    )
    api_client.force_authenticate(employees["hr"].user)
    response = api_client.post(
        URL.format(document.id),
        {"expected_version": document.version, "gap_case_ids": [str(case.id)]},
    )
    assert response.status_code == 200
    data = response.data
    assert data["scope"] == "extractive_retrieval_comparison"
    assert data["not_legal_verification"] is True
    assert data["document"]["has_unpublished_changes"] is True
    result = data["results"][0]
    assert result["source"] == "gap_case"
    assert result["gap_case_id"] == str(case.id)
    assert result["classification"] == "lost"
    assert result["before"]["reason"] == "lexical_evidence"
    assert result["before"]["excerpts"][0]["origin"] == "published"
    assert result["before"]["excerpts"][0]["chunk_id"] is not None
    assert result["after"]["reason"] == "no_matching_policy"
    assert result["after"]["excerpts"] == []
    assert data["summary"] == {
        "total": 1,
        "unchanged": 0,
        "changed": 0,
        "lost": 1,
        "gained": 0,
    }
    assert data["impacted_employees_count"] == 1
    assert data["audience_impact"]["eligible_current"] > data["audience_impact"]["eligible_draft"]


def test_unpublished_draft_document_gains_evidence(api_client, employees, make_policy):
    document = make_policy(
        publish=False,
        title="Стипендия цифровизации",
        topic="stipend",
        text=(
            "Экспериментальная стипендия цифровизации выплачивается ежеквартально "
            "сотрудникам дистанционных команд после утверждения руководителем."
        ),
    )
    api_client.force_authenticate(employees["hr"].user)
    response = api_client.post(
        URL.format(document.id),
        {
            "expected_version": document.version,
            "questions": ["Как получить стипендию цифровизации?"],
        },
    )
    assert response.status_code == 200
    data = response.data
    assert data["current"] is None
    assert data["audience_impact"]["eligible_current"] is None
    result = data["results"][0]
    assert result["source"] == "explicit"
    assert result["gap_case_id"] is None
    assert result["classification"] == "gained"
    assert result["before"]["reason"] == "no_matching_policy"
    excerpt = result["after"]["excerpts"][0]
    assert excerpt["origin"] == "draft"
    assert excerpt["chunk_id"] is None
    assert excerpt["revision_id"] is None
    assert "стипендия цифровизации" in excerpt["text"]


def test_changed_when_draft_rewrites_matched_section(api_client, employees, make_policy):
    document = make_policy(
        title="Компенсация транспорта",
        topic="benefits",
        text=(
            "Компенсация транспорта выплачивается сотрудникам ежемесячно "
            "в размере 15000 тенге по актуальной ведомости."
        ),
    )
    document = update_document(
        employees["hr"].user,
        document.id,
        document.version,
        {
            "draft_sections": [
                {
                    "heading": "Компенсация транспорта",
                    "text": (
                        "Компенсация транспорта заменена дотацией на парковку "
                        "для сотрудников центрального офиса с 1 января следующего года."
                    ),
                }
            ]
        },
    )
    api_client.force_authenticate(employees["hr"].user)
    response = api_client.post(
        URL.format(document.id),
        {
            "expected_version": document.version,
            "questions": ["Как работает компенсация транспорта?"],
        },
    )
    assert response.status_code == 200
    result = response.data["results"][0]
    assert result["classification"] == "changed"
    before, after = result["before"], result["after"]
    assert before["excerpts"][0]["origin"] == "published"
    assert after["excerpts"][0]["origin"] == "draft"
    assert before["excerpts"][0]["content_hash"] != after["excerpts"][0]["content_hash"]


def test_unrelated_documents_stay_in_corpus_and_answer_unchanged(
    api_client, employees, make_policy
):
    make_policy()
    other = make_policy(
        title="Порядок выплаты аванса",
        topic="advance",
        text=(
            "Аванс на заработную плату выплачивается сотрудникам после утвержденной "
            "заявки до двадцать пятого числа текущего месяца."
        ),
    )
    api_client.force_authenticate(employees["hr"].user)
    response = api_client.post(
        URL.format(other.id),
        {
            "expected_version": other.version,
            "questions": ["Как подать заявку на отпуск?"],
        },
    )
    assert response.status_code == 200
    result = response.data["results"][0]
    assert result["classification"] == "unchanged"
    assert result["before"]["excerpts"]
    assert result["before"]["excerpts"] == result["after"]["excerpts"]


def test_rehearsal_writes_nothing(api_client, employees, make_policy):
    document = make_policy()
    counts = {
        model: model.objects.count()
        for model in (
            KnowledgeRevision,
            KnowledgeChunk,
            AssistantAnswer,
            KnowledgeGapCase,
            DomainEvent,
            Notification,
        )
    }
    version = document.version
    api_client.force_authenticate(employees["hr"].user)
    response = api_client.post(
        URL.format(document.id),
        {
            "expected_version": document.version,
            "questions": ["Как подать заявку на отпуск?"],
        },
    )
    assert response.status_code == 200
    document.refresh_from_db()
    assert document.version == version
    for model, count in counts.items():
        assert model.objects.count() == count


def test_rehearsal_access_and_stale_version(api_client, employees, make_policy):
    document = make_policy()
    payload = {
        "expected_version": document.version,
        "questions": ["Как подать заявку на отпуск?"],
    }
    url = URL.format(document.id)
    api_client.force_authenticate(employees["employee"].user)
    assert api_client.post(url, payload).status_code == 403
    foreign = _foreign_hr(employees)
    api_client.force_authenticate(foreign.user)
    assert api_client.post(url, payload).status_code == 404
    api_client.force_authenticate(employees["hr"].user)
    assert api_client.post(url, {**payload, "expected_version": 99}).status_code == 409
    assert api_client.post(url, payload).status_code == 200


def test_question_bound_and_unknown_scoped_questions(api_client, employees, make_policy):
    document = make_policy()
    url = URL.format(document.id)
    api_client.force_authenticate(employees["hr"].user)
    many = {
        "expected_version": document.version,
        "questions": [f"Вопрос про отпуск номер {index}?" for index in range(11)],
    }
    response = api_client.post(url, many)
    assert response.status_code == 400
    response = api_client.post(
        url,
        {
            "expected_version": document.version,
            "gap_case_ids": [str(uuid.uuid4())],
        },
    )
    assert response.status_code == 404
    response = api_client.post(url, {"expected_version": document.version})
    assert response.status_code == 400


def test_foreign_entity_gap_case_never_leaks(api_client, employees, make_policy):
    document = make_policy()
    foreign_case = _gap_case(employees["other_entity"], "Какие правила действуют в другой стране?")
    api_client.force_authenticate(employees["hr"].user)
    response = api_client.post(
        URL.format(document.id),
        {
            "expected_version": document.version,
            "gap_case_ids": [str(foreign_case.id)],
        },
    )
    assert response.status_code == 404
    assert "question" not in response.text.lower() or foreign_case.question not in response.text


def _global_employee_policy(employees):
    admin = User.objects.create_superuser(username="root", password="Synthetic-test-password-42!")
    document = create_document(
        admin,
        {
            "slug": f"global-{uuid.uuid4().hex}",
            "title": "Глобальная льгота сотрудников",
            "summary": "Синтетический глобальный регламент только для сотрудников.",
            "language": "ru",
            "topic": "benefits",
            "owner": employees["hr"],
            "legal_entity": None,
            "department": None,
            "audience": "employee",
            "draft_sections": [
                {
                    "heading": "Льгота",
                    "text": (
                        "Секретная льгота SECRET-BENEFIT-777 доступна сотрудникам "
                        "по заявлению через портал в течение всего года."
                    ),
                }
            ],
            "effective_from": timezone.localdate() - timedelta(days=1),
            "is_synthetic": True,
        },
    )
    return publish_document(admin, document.id, document.version)


def test_employee_scoped_question_hides_documents_hr_cannot_read_or_manage(
    api_client, employees, make_policy
):
    document = make_policy()
    restricted = _global_employee_policy(employees)
    case = _gap_case(employees["employee"], "Какая секретная льгота доступна сотрудникам?")
    api_client.force_authenticate(employees["hr"].user)
    assert api_client.get(f"/api/v1/knowledge/documents/{restricted.id}/").status_code == 404
    assert api_client.get(f"/api/v1/knowledge/admin/documents/{restricted.id}/").status_code == 404
    response = api_client.post(
        URL.format(document.id),
        {"expected_version": document.version, "gap_case_ids": [str(case.id)]},
    )
    assert response.status_code == 200
    result = response.data["results"][0]
    assert result["before"]["reason"] == "lexical_evidence"
    assert result["before"]["excerpts"] == []
    assert result["before"]["restricted_excerpts"] == 1
    assert result["after"]["restricted_excerpts"] == 1
    assert "SECRET-BENEFIT-777" not in response.text
    assert "Глобальная льгота" not in response.text


def test_archived_document_cannot_be_rehearsed(api_client, employees, make_policy):
    from apps.knowledge.services import archive_document

    document = make_policy()
    document = archive_document(employees["hr"].user, document.id, document.version)
    api_client.force_authenticate(employees["hr"].user)
    response = api_client.post(
        URL.format(document.id),
        {
            "expected_version": document.version,
            "questions": ["Как подать заявку на отпуск?"],
        },
    )
    assert response.status_code == 400
