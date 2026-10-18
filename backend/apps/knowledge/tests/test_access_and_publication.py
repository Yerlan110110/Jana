import uuid
from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework.test import APIClient

from apps.knowledge.models import KnowledgeChunk, KnowledgeDocument, KnowledgeRevision
from apps.knowledge.services import archive_document, publish_document, update_document

pytestmark = pytest.mark.django_db


def test_anonymous_cannot_read_knowledge(api_client):
    assert api_client.get("/api/v1/knowledge/documents/").status_code == 401


def test_scope_applies_to_lists_details_and_citations(api_client, employees, make_policy):
    public = make_policy()
    private = make_policy(
        audience="hr",
        text="Контроль закрытия расчетного периода использует секретный учебный маркер PRIVATE-HR-900.",
    )
    local = make_policy(department=employees["employee"].department)
    other_department = make_policy(department=employees["other_team"].department)
    api_client.force_authenticate(employees["employee"].user)
    response = api_client.get("/api/v1/knowledge/documents/")
    ids = {item["id"] for item in response.data["results"]}
    assert ids == {str(public.id), str(local.id)}
    for document in (private, other_department):
        assert api_client.get(f"/api/v1/knowledge/documents/{document.id}/").status_code == 404
        chunk = document.current_revision.chunks.first()
        assert api_client.get(f"/api/v1/knowledge/citations/{chunk.id}/").status_code == 404
    api_client.force_authenticate(employees["other_entity"].user)
    assert api_client.get("/api/v1/knowledge/documents/").data["count"] == 0
    assert api_client.get(f"/api/v1/knowledge/documents/{public.id}/").status_code == 404


def test_only_current_effective_published_documents_are_visible(api_client, employees, make_policy):
    current = make_policy()
    make_policy(publish=False)
    make_policy(effective_from=timezone.localdate() + timedelta(days=1))
    make_policy(
        effective_from=timezone.localdate() - timedelta(days=3),
        effective_until=timezone.localdate(),
    )
    archived = make_policy()
    archive_document(employees["hr"].user, archived.id, archived.version)
    api_client.force_authenticate(employees["employee"].user)
    assert [
        item["id"] for item in api_client.get("/api/v1/knowledge/documents/").data["results"]
    ] == [str(current.id)]


def test_draft_changes_do_not_change_published_text_or_scope(
    api_client, employees, make_policy, knowledge_check_payload
):
    document = make_policy()
    old_revision = document.current_revision
    old_chunk = old_revision.chunks.first()
    document = update_document(
        employees["hr"].user,
        document.id,
        document.version,
        {
            "title": "Черновик закрытого регламента",
            "audience": "hr",
            "draft_knowledge_check": knowledge_check_payload,
            "draft_sections": [
                {
                    "heading": "Закрытый текст",
                    "text": "Новый закрытый текст черновика не должен быть виден сотруднику до публикации.",
                }
            ],
        },
    )
    api_client.force_authenticate(employees["employee"].user)
    response = api_client.get(f"/api/v1/knowledge/documents/{document.id}/")
    assert response.status_code == 200
    assert response.data["revision"]["title"] == old_revision.title
    assert "Закрытый текст" not in str(response.data)
    assert api_client.get(f"/api/v1/knowledge/citations/{old_chunk.id}/").status_code == 200
    publish_document(employees["hr"].user, document.id, document.version)
    assert api_client.get(f"/api/v1/knowledge/documents/{document.id}/").status_code == 404
    assert api_client.get(f"/api/v1/knowledge/citations/{old_chunk.id}/").status_code == 404
    assert KnowledgeRevision.objects.get(pk=old_revision.id).title == old_revision.title


def test_revisions_and_chunks_are_immutable(make_policy):
    document = make_policy()
    revision = document.current_revision
    revision.title = "Подмена"
    with pytest.raises(DjangoValidationError):
        revision.save()
    with pytest.raises(DjangoValidationError):
        KnowledgeRevision.objects.filter(pk=revision.id).update(title="Подмена")
    with pytest.raises(DjangoValidationError):
        KnowledgeChunk.objects.filter(revision=revision).delete()
    with pytest.raises(DjangoValidationError):
        revision.delete()


def test_widened_publication_does_not_expose_old_restricted_revision(
    api_client, employees, make_policy, knowledge_check_payload
):
    document = make_policy(
        audience="hr",
        text="Закрытый источник содержит учебный маркер SYN-OLD-RESTRICTED. Его аудитория ограничена ролью HR.",
    )
    old_chunk = document.current_revision.chunks.first()
    document = update_document(
        employees["hr"].user,
        document.id,
        document.version,
        {
            "audience": "all",
            "draft_knowledge_check": knowledge_check_payload,
            "draft_sections": [
                {
                    "heading": "Общая информация",
                    "text": "Новая редакция содержит общую информацию и не раскрывает прежний закрытый источник.",
                }
            ],
        },
    )
    publish_document(employees["hr"].user, document.id, document.version)
    api_client.force_authenticate(employees["employee"].user)
    assert api_client.get(f"/api/v1/knowledge/documents/{document.id}/").status_code == 200
    assert api_client.get(f"/api/v1/knowledge/citations/{old_chunk.id}/").status_code == 404


def test_employee_cannot_edit_publish_or_supply_sensitive_fields(
    api_client, employees, make_policy
):
    document = make_policy()
    api_client.force_authenticate(employees["employee"].user)
    assert api_client.post("/api/v1/knowledge/admin/documents/", {}).status_code == 403
    assert (
        api_client.post(
            f"/api/v1/knowledge/admin/documents/{document.id}/publish/",
            {"expected_version": document.version},
            HTTP_IDEMPOTENCY_KEY="publish-denied",
        ).status_code
        == 403
    )
    api_client.force_authenticate(employees["hr"].user)
    response = api_client.patch(
        f"/api/v1/knowledge/admin/documents/{document.id}/",
        {
            "expected_version": document.version,
            "state": "published",
            "current_revision": str(uuid.uuid4()),
        },
        HTTP_IDEMPOTENCY_KEY="mass-assignment",
    )
    assert response.status_code == 400
    assert set(response.data["field_errors"]) == {"state", "current_revision"}


def test_publication_replay_and_stale_version(api_client, employees, make_policy):
    document = make_policy(publish=False)
    api_client.force_authenticate(employees["hr"].user)
    url = f"/api/v1/knowledge/admin/documents/{document.id}/publish/"
    payload = {"expected_version": document.version}
    first = api_client.post(url, payload, HTTP_IDEMPOTENCY_KEY="publish-once")
    assert first.status_code == 200
    repeated = api_client.post(url, payload, HTTP_IDEMPOTENCY_KEY="publish-once")
    assert repeated.status_code == 200
    assert repeated.data == first.data
    assert repeated["Idempotency-Replayed"] == "true"
    assert document.revisions.count() == 1
    assert api_client.post(url, payload, HTTP_IDEMPOTENCY_KEY="publish-stale").status_code == 409
    assert (
        api_client.post(
            url, {"expected_version": document.version + 1}, HTTP_IDEMPOTENCY_KEY="publish-once"
        ).status_code
        == 409
    )


def test_hr_cannot_create_content_for_another_entity_or_owner(api_client, employees):
    api_client.force_authenticate(employees["hr"].user)
    base = {
        "slug": "forged-owner",
        "title": "Проверка владельца",
        "language": "ru",
        "topic": "access",
        "draft_sections": [
            {
                "heading": "Проверка",
                "text": "Синтетический текст для проверки прав владельца документа.",
            }
        ],
    }
    for override in (
        {"legal_entity": str(employees["other_entity"].legal_entity_id)},
        {"owner": str(employees["employee"].id)},
        {"legal_entity": None},
    ):
        response = api_client.post(
            "/api/v1/knowledge/admin/documents/",
            {**base, **override},
            HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()),
        )
        assert response.status_code in {400, 403}
    assert KnowledgeDocument.objects.count() == 0


def test_inactive_profile_loses_knowledge_access_in_an_existing_session(
    api_client, employees, make_policy
):
    document = make_policy()
    employee = employees["employee"]
    api_client.force_authenticate(employee.user)
    assert api_client.get(f"/api/v1/knowledge/documents/{document.id}/").status_code == 200
    employee.is_active = False
    employee.save()
    assert api_client.get(f"/api/v1/knowledge/documents/{document.id}/").status_code == 403


def test_unsafe_knowledge_posts_require_csrf_in_session(employees, question_payload):
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(employees["employee"].user)
    response = client.post("/api/v1/assistant/answers/", question_payload)
    assert response.status_code == 403
