import hashlib
import json

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.core.errors import Conflict
from apps.core.events import emit
from apps.identity.models import Employee, User
from apps.identity.permissions import require_hr
from apps.notifications.services import notify

from .models import (
    AssistantAnswer,
    KnowledgeChunk,
    KnowledgeDocument,
    KnowledgeGapCase,
    KnowledgeRevision,
)
from .provider import GenerationConfig, ProviderUnavailable, generate_claims
from .retrieval import retrieve
from .selectors import manageable_documents, own_answers, require_active_actor, visible_gap_cases


def _check_version(record, expected_version):
    if record.version != expected_version:
        raise Conflict("This record has changed. Reload it before saving your changes.")


def _validate_document(document):
    if not document.owner.is_active or not document.owner.user.is_active:
        raise ValidationError({"owner": "Choose an active HR owner."})
    if document.owner.user.role != User.Role.HR and not document.owner.user.is_superuser:
        raise ValidationError({"owner": "Choose an HR owner."})
    document.full_clean()


def _snapshot(document):
    return {
        "title": document.title,
        "summary": document.summary,
        "language": document.language,
        "topic": document.topic,
        "owner_id": document.owner_id,
        "legal_entity_id": document.legal_entity_id,
        "department_id": document.department_id,
        "audience": document.audience,
        "sections": document.draft_sections,
        "effective_from": document.effective_from,
        "effective_until": document.effective_until,
        "is_synthetic": document.is_synthetic,
    }


def draft_hash(document):
    content = json.dumps(_snapshot(document), sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(content.encode()).hexdigest()


@transaction.atomic
def create_document(user, data):
    employee = require_active_actor(user)
    require_hr(user)
    values = dict(data)
    if "owner" not in values:
        if employee is None:
            raise ValidationError({"owner": "Choose an HR owner for the document."})
        values["owner"] = employee
    if "legal_entity" not in values:
        values["legal_entity"] = employee.legal_entity if employee else None
    if values["legal_entity"] is None and not user.is_superuser:
        raise PermissionDenied("Only a technical administrator can publish company-wide content.")
    require_hr(user, values["legal_entity"])
    document = KnowledgeDocument(**values)
    _validate_document(document)
    document.save()
    emit(
        "knowledge.document_created",
        "knowledge_document",
        document.id,
        {"version": document.version},
        user,
    )
    return document


def _locked_document(user, document_id):
    require_hr(user)
    document = (
        manageable_documents(user).select_for_update(of=("self",)).filter(pk=document_id).first()
    )
    if document is None:
        raise NotFound()
    return document


@transaction.atomic
def update_document(user, document_id, expected_version, data):
    document = _locked_document(user, document_id)
    _check_version(document, expected_version)
    for name, value in data.items():
        setattr(document, name, value)
    _validate_document(document)
    document.version += 1
    document.save()
    emit(
        "knowledge.draft_updated",
        "knowledge_document",
        document.id,
        {"version": document.version},
        user,
    )
    return document


def _chunks(revision):
    ordinal = 0
    for section_number, section in enumerate(revision.sections, start=1):
        text = section["text"]
        start = 0
        while start < len(text):
            end = min(start + 1400, len(text))
            if end < len(text):
                boundary = text.rfind(" ", start + 700, end)
                if boundary > start:
                    end = boundary
            excerpt = text[start:end]
            if excerpt.strip():
                ordinal += 1
                yield KnowledgeChunk(
                    revision=revision,
                    section_number=section_number,
                    ordinal=ordinal,
                    heading=section["heading"],
                    text=excerpt,
                    start_offset=start,
                    end_offset=end,
                    content_hash=hashlib.sha256(excerpt.encode()).hexdigest(),
                )
            start = end


@transaction.atomic
def publish_document(user, document_id, expected_version):
    document = _locked_document(user, document_id)
    _check_version(document, expected_version)
    _validate_document(document)
    if not document.draft_sections:
        raise ValidationError({"draft_sections": "Add at least one section before publishing."})
    content_hash = draft_hash(document)
    if (
        document.state == KnowledgeDocument.State.PUBLISHED
        and document.current_revision.content_hash == content_hash
    ):
        raise Conflict(
            "This draft is already published. Edit the draft before publishing another revision."
        )
    number = (document.revisions.aggregate(last=Max("number"))["last"] or 0) + 1
    revision = KnowledgeRevision.objects.create(
        document=document,
        number=number,
        published_by=user,
        content_hash=content_hash,
        **_snapshot(document),
    )
    KnowledgeChunk.objects.bulk_create(list(_chunks(revision)))
    document.current_revision = revision
    document.state = KnowledgeDocument.State.PUBLISHED
    document.version += 1
    document.save(update_fields=["current_revision", "state", "version", "updated_at"])
    emit(
        "knowledge.revision_published",
        "knowledge_document",
        document.id,
        {"revision_id": str(revision.id), "number": revision.number, "content_hash": content_hash},
        user,
    )
    return document


@transaction.atomic
def archive_document(user, document_id, expected_version):
    document = _locked_document(user, document_id)
    _check_version(document, expected_version)
    if document.state == KnowledgeDocument.State.ARCHIVED:
        return document
    document.state = KnowledgeDocument.State.ARCHIVED
    document.version += 1
    document.save(update_fields=["state", "version", "updated_at"])
    emit(
        "knowledge.document_archived",
        "knowledge_document",
        document.id,
        {"version": document.version},
        user,
    )
    return document


def _check_same_message(answer, question, language):
    if answer.question != question or answer.language != language:
        raise Conflict(
            "This client_message_id belongs to another question. Use a new id for a new question."
        )


def ask_question(user, question, language, client_message_id):
    require_active_actor(user)
    existing = own_answers(user).filter(client_message_id=client_message_id).first()
    if existing:
        _check_same_message(existing, question, language)
        return existing, False
    result = retrieve(user, question, language)
    mode = AssistantAnswer.Mode.INSUFFICIENT
    reason = result.reason
    claims = []
    provider = ""
    model = ""
    if result.chunks:
        try:
            config = GenerationConfig.from_environment()
            provider, model = config.provider, config.model if config.provider == "openai" else ""
            if config.provider == "extractive":
                mode = AssistantAnswer.Mode.EXTRACTIVE
                claims = [
                    {
                        "text": item.chunk.text,
                        "supports": [{"chunk_id": str(item.chunk.id), "quote": item.chunk.text}],
                    }
                    for item in result.chunks
                ]
            else:
                claims = generate_claims(config, question, language, result.chunks)
                mode = (
                    AssistantAnswer.Mode.GENERATED if claims else AssistantAnswer.Mode.INSUFFICIENT
                )
                reason = "generated_from_evidence" if claims else "no_matching_policy"
        except ProviderUnavailable as exc:
            mode, reason = AssistantAnswer.Mode.UNAVAILABLE, exc.reason
    with transaction.atomic():
        answer, created = AssistantAnswer.objects.get_or_create(
            user=user,
            client_message_id=client_message_id,
            defaults={
                "question": question,
                "language": language,
                "mode": mode,
                "reason": reason,
                "claims": claims,
                "provider": provider,
                "model": model,
            },
        )
        _check_same_message(answer, question, language)
        if created:
            emit(
                "knowledge.answer_created",
                "assistant_answer",
                answer.id,
                {"mode": mode, "reason": reason},
                user,
            )
    return answer, created


@transaction.atomic
def escalate_answer(user, answer_id, details=""):
    employee = require_active_actor(user)
    if employee is None:
        raise PermissionDenied("An employee profile is required to contact HR through this portal.")
    answer = own_answers(user).select_for_update().filter(pk=answer_id).first()
    if answer is None:
        raise NotFound()
    case, created = KnowledgeGapCase.objects.get_or_create(
        answer=answer,
        defaults={
            "employee": employee,
            "legal_entity": employee.legal_entity,
            "question": answer.question,
            "details": details,
        },
    )
    if not created:
        if case.details != details:
            raise Conflict("This question already has an HR case. Open the existing case.")
        return case, False
    event = emit(
        "knowledge.gap_opened", "knowledge_gap", case.id, {"employee_id": str(employee.id)}, user
    )
    recipients = Employee.objects.filter(
        legal_entity=employee.legal_entity,
        is_active=True,
        user__is_active=True,
        user__role=User.Role.HR,
    ).select_related("user")
    for recipient in recipients:
        notify(
            recipient.user,
            "knowledge_gap_opened",
            "Вопрос сотрудника",
            "Откройте вопрос и ответьте сотруднику.",
            "knowledge_gap",
            case.id,
            event,
        )
    return case, True


@transaction.atomic
def resolve_gap_case(user, case_id, expected_version, response):
    require_hr(user)
    case = visible_gap_cases(user).select_for_update(of=("self",)).filter(pk=case_id).first()
    if case is None:
        raise NotFound()
    require_hr(user, case.legal_entity_id)
    _check_version(case, expected_version)
    if case.status != KnowledgeGapCase.Status.OPEN:
        raise Conflict("This question is already resolved. Open the saved HR response.")
    case.response = response
    case.status = KnowledgeGapCase.Status.RESOLVED
    case.resolved_by = user
    case.resolved_at = timezone.now()
    case.version += 1
    case.save(
        update_fields=["response", "status", "resolved_by", "resolved_at", "version", "updated_at"]
    )
    event = emit(
        "knowledge.gap_resolved", "knowledge_gap", case.id, {"version": case.version}, user
    )
    notify(
        case.employee.user,
        "knowledge_gap_resolved",
        "HR ответил на вопрос",
        "Откройте вопрос, чтобы прочитать ответ HR.",
        "knowledge_gap",
        case.id,
        event,
    )
    return case
