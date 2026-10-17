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


def test_resolution_links_an_immutable_published_revision(
    api_client, employees, unsupported_answer, make_policy
):
    case, _ = escalate_answer(employees["employee"].user, unsupported_answer.id)
    policy = make_policy()
    api_client.force_authenticate(employees["hr"].user)
    response = api_client.post(
        f"/api/v1/knowledge/gaps/{case.id}/resolve/",
        {
            "expected_version": 1,
            "response": "Ответ основан на опубликованном демонстрационном правиле.",
            "published_revision_id": str(policy.current_revision_id),
        },
        HTTP_IDEMPOTENCY_KEY="resolve-with-policy",
    )
    assert response.status_code == 200
    assert response.data["resolution_kind"] == "published_policy"
    reference = response.json()["policy_reference"]
    assert reference["state"] == "current"
    assert reference["revision_id"] == str(policy.current_revision_id)
    assert reference["revision"]["sections"] == policy.current_revision.sections
    api_client.force_authenticate(employees["employee"].user)
    opened = api_client.get(f"/api/v1/knowledge/gaps/{case.id}/policy-reference/")
    assert opened.status_code == 200
    assert opened.json() == reference


def resolve_with_policy(client, hr, case, revision_id, key="linked-resolution", version=1):
    client.force_authenticate(hr.user)
    return client.post(
        f"/api/v1/knowledge/gaps/{case.id}/resolve/",
        {
            "expected_version": version,
            "response": "Ответ основан на опубликованном демонстрационном правиле.",
            "published_revision_id": str(revision_id),
        },
        HTTP_IDEMPOTENCY_KEY=key,
    )


def test_linked_resolution_replays_once_and_conflicts_on_new_intent(
    api_client, employees, unsupported_answer, make_policy
):
    case, _ = escalate_answer(employees["employee"].user, unsupported_answer.id)
    policy = make_policy()
    first = resolve_with_policy(api_client, employees["hr"], case, policy.current_revision_id)
    assert first.status_code == 200
    repeated = resolve_with_policy(api_client, employees["hr"], case, policy.current_revision_id)
    assert repeated.json() == first.json()
    assert repeated["Idempotency-Replayed"] == "true"
    stale = resolve_with_policy(
        api_client, employees["hr"], case, policy.current_revision_id, key="stale"
    )
    assert stale.status_code == 409
    changed = make_policy()
    assert (
        resolve_with_policy(
            api_client, employees["hr"], case, changed.current_revision_id
        ).status_code
        == 409
    )
    assert DomainEvent.objects.filter(event_type="knowledge.gap_resolved").count() == 1
    assert Notification.objects.filter(kind="knowledge_gap_resolved").count() == 1
    original = api_client.get(f"/api/v1/assistant/answers/{unsupported_answer.id}/")
    assert original.status_code == 404
    api_client.force_authenticate(employees["employee"].user)
    original = api_client.get(f"/api/v1/assistant/answers/{unsupported_answer.id}/").json()
    assert original["mode"] == "insufficient_evidence"
    assert original["claims"] == []


@pytest.mark.parametrize(
    "restriction",
    [
        "hr_only",
        "employee_only",
        "other_department",
        "foreign",
        "draft",
        "future",
        "expired",
        "unknown",
    ],
)
def test_resolution_rejects_sources_unavailable_to_resolver_or_owner(
    api_client, employees, unsupported_answer, make_policy, restriction
):
    from datetime import timedelta

    from django.utils import timezone

    case, _ = escalate_answer(employees["employee"].user, unsupported_answer.id)
    options = {
        "hr_only": {"audience": "hr"},
        "employee_only": {"audience": "employee"},
        "other_department": {"department": employees["hr"].department},
        "foreign": {"actor": employees["other_entity"]},
        "draft": {"publish": False},
        "future": {"effective_from": timezone.localdate() + timedelta(days=1)},
        "expired": {
            "effective_from": timezone.localdate() - timedelta(days=3),
            "effective_until": timezone.localdate(),
        },
        "unknown": {},
    }[restriction]
    if restriction == "foreign":
        employees["other_entity"].user.role = "hr"
        employees["other_entity"].user.save()
    policy = make_policy(**options)
    revision_id = policy.current_revision_id or policy.pk
    if restriction == "unknown":
        revision_id = uuid.uuid4()
    response = resolve_with_policy(api_client, employees["hr"], case, revision_id)
    assert response.status_code == 404
    detail = api_client.get(f"/api/v1/knowledge/gaps/{case.id}/").json()
    assert detail["status"] == "open"
    assert detail["policy_reference"] is None
    assert not DomainEvent.objects.filter(event_type="knowledge.gap_resolved").exists()
    assert not IdempotencyRecord.objects.filter(key="linked-resolution").exists()


@pytest.mark.parametrize("actor", ["employee", "manager", "peer", "other_entity"])
def test_link_and_reference_obey_case_role_and_entity_scope(
    api_client, employees, unsupported_answer, make_policy, actor
):
    case, _ = escalate_answer(employees["employee"].user, unsupported_answer.id)
    policy = make_policy()
    assert (
        resolve_with_policy(
            api_client, employees[actor], case, policy.current_revision_id
        ).status_code
        == 403
    )
    assert (
        resolve_with_policy(
            api_client, employees["hr"], case, policy.current_revision_id
        ).status_code
        == 200
    )
    api_client.force_authenticate(employees[actor].user)
    status = 200 if actor == "employee" else 404
    assert (
        api_client.get(f"/api/v1/knowledge/gaps/{case.id}/policy-reference/").status_code == status
    )
    if actor == "other_entity":
        employees[actor].user.role = "hr"
        employees[actor].user.save()
        assert (
            resolve_with_policy(
                api_client, employees[actor], case, policy.current_revision_id, key="foreign-hr"
            ).status_code
            == 404
        )


@pytest.mark.parametrize(
    "revocation",
    [
        "archive",
        "audience",
        "owner_transfer",
        "owner_inactive",
        "resolver_transfer",
        "resolver_role",
    ],
)
def test_reference_and_command_replay_recheck_current_access(
    api_client, employees, unsupported_answer, make_policy, revocation
):
    from apps.knowledge.services import archive_document, publish_document, update_document

    case, _ = escalate_answer(employees["employee"].user, unsupported_answer.id)
    policy = make_policy()
    assert (
        resolve_with_policy(
            api_client, employees["hr"], case, policy.current_revision_id
        ).status_code
        == 200
    )
    hr, employee = employees["hr"], employees["employee"]
    if revocation == "archive":
        archive_document(hr.user, policy.pk, policy.version)
    elif revocation == "audience":
        changed = update_document(hr.user, policy.pk, policy.version, {"audience": "hr"})
        publish_document(hr.user, changed.pk, changed.version)
    elif revocation in {"owner_transfer", "resolver_transfer"}:
        actor = employee if revocation == "owner_transfer" else hr
        actor.manager = None
        actor.legal_entity = employees["other_entity"].legal_entity
        actor.department = employees["other_entity"].department
        actor.save()
    elif revocation == "owner_inactive":
        employee.is_active = False
        employee.save()
    elif revocation == "resolver_role":
        hr.user.role = "employee"
        hr.user.save()
    repeated = resolve_with_policy(api_client, hr, case, policy.current_revision_id)
    assert repeated.status_code == (403 if revocation == "resolver_role" else 404)
    api_client.force_authenticate(employee.user if revocation != "owner_inactive" else hr.user)
    for url in [
        f"/api/v1/knowledge/gaps/{case.id}/",
        f"/api/v1/knowledge/gaps/{case.id}/policy-reference/",
    ]:
        response = api_client.get(url)
        assert response.status_code == 200
        reference = (
            response.json()["policy_reference"] if url.endswith(f"{case.id}/") else response.json()
        )
        if revocation in {"resolver_transfer", "resolver_role"}:
            assert reference["state"] == "current"
        else:
            assert reference["state"] == "unavailable"
            assert reference["revision"] is None
            assert policy.current_revision.title not in str(reference)
    assert DomainEvent.objects.filter(event_type="knowledge.gap_resolved").count() == 1
    assert Notification.objects.filter(kind="knowledge_gap_resolved").count() == 1


def test_new_publication_preserves_link_and_replay_reads_superseded_state(
    api_client, employees, unsupported_answer, make_policy
):
    from apps.knowledge.services import publish_document, update_document

    case, _ = escalate_answer(employees["employee"].user, unsupported_answer.id)
    policy = make_policy()
    old_id = policy.current_revision_id
    assert resolve_with_policy(api_client, employees["hr"], case, old_id).status_code == 200
    policy = update_document(
        employees["hr"].user, policy.pk, policy.version, {"title": "Новая версия"}
    )
    publish_document(employees["hr"].user, policy.pk, policy.version)
    replay = resolve_with_policy(api_client, employees["hr"], case, old_id)
    assert replay.status_code == 200
    assert replay["Idempotency-Replayed"] == "true"
    reference = replay.json()["policy_reference"]
    assert reference["state"] == "superseded"
    assert reference["revision_id"] == str(old_id)
    assert reference["revision"]["title"] == "Порядок отпуска"
    api_client.force_authenticate(employees["employee"].user)
    assert api_client.get(f"/api/v1/knowledge/gaps/{case.id}/policy-reference/").json() == reference


def test_linked_resolution_rolls_back_link_event_notification_and_receipt(
    api_client, employees, unsupported_answer, make_policy
):
    case, _ = escalate_answer(employees["employee"].user, unsupported_answer.id)
    policy = make_policy()
    with patch(
        "apps.knowledge.services.notify", side_effect=RuntimeError("Synthetic resolution failure")
    ):
        with pytest.raises(RuntimeError, match="Synthetic resolution failure"):
            resolve_with_policy(api_client, employees["hr"], case, policy.current_revision_id)
    detail = api_client.get(f"/api/v1/knowledge/gaps/{case.id}/").json()
    assert detail["status"] == "open"
    assert detail["version"] == 1
    assert detail["policy_reference"] is None
    assert not DomainEvent.objects.filter(event_type="knowledge.gap_resolved").exists()
    assert not Notification.objects.filter(kind="knowledge_gap_resolved").exists()
    assert not IdempotencyRecord.objects.filter(key="linked-resolution").exists()
    assert (
        resolve_with_policy(
            api_client, employees["hr"], case, policy.current_revision_id
        ).status_code
        == 200
    )


def test_hr_publishes_policy_then_links_case_and_retrieval_uses_publication(
    api_client, employees, unsupported_answer
):
    api_client.force_authenticate(employees["employee"].user)
    escalated = api_client.post(
        "/api/v1/knowledge/gaps/",
        {"answer_id": str(unsupported_answer.id)},
        HTTP_IDEMPOTENCY_KEY="publish-chain-case",
    )
    assert escalated.status_code == 201
    case_id = escalated.json()["id"]
    api_client.force_authenticate(employees["hr"].user)
    created = api_client.post(
        "/api/v1/knowledge/admin/documents/",
        {
            "slug": "synthetic-mortgage-policy",
            "title": "Демонстрационная корпоративная ипотека",
            "language": "ru",
            "topic": "mortgage",
            "is_synthetic": True,
            "draft_sections": [
                {
                    "heading": "Условия программы",
                    "text": "Корпоративная ипотека в демонстрационной компании не предоставляется. Для уточнения доступных программ сотрудник обращается к HR.",
                }
            ],
        },
        HTTP_IDEMPOTENCY_KEY="publish-chain-draft",
    )
    assert created.status_code == 201
    document = created.json()
    published = api_client.post(
        f"/api/v1/knowledge/admin/documents/{document['id']}/publish/",
        {"expected_version": document["version"]},
        HTTP_IDEMPOTENCY_KEY="publish-chain-policy",
    )
    assert published.status_code == 200
    revision_id = published.json()["current_revision"]["id"]
    resolved = api_client.post(
        f"/api/v1/knowledge/gaps/{case_id}/resolve/",
        {
            "expected_version": 1,
            "response": "HR опубликовал демонстрационное правило. Прочитайте условия программы.",
            "published_revision_id": revision_id,
        },
        HTTP_IDEMPOTENCY_KEY="publish-chain-resolve",
    )
    assert resolved.status_code == 200
    api_client.force_authenticate(employees["employee"].user)
    detail = api_client.get(f"/api/v1/knowledge/gaps/{case_id}/").json()
    assert detail["policy_reference"]["revision_id"] == revision_id
    answer = api_client.post(
        "/api/v1/assistant/answers/",
        {
            "question": unsupported_answer.question,
            "language": "ru",
            "client_message_id": str(uuid.uuid4()),
        },
    )
    assert answer.status_code == 201
    assert answer.json()["mode"] == "extractive"
    assert {item["revision_id"] for item in answer.json()["citations"]} == {revision_id}
    original = api_client.get(f"/api/v1/assistant/answers/{unsupported_answer.id}/").json()
    assert original["mode"] == "insufficient_evidence"
    assert original["citations"] == []
