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

from .changes import policy_text_changed
from .models import (
    AssistantAnswer,
    KnowledgeChunk,
    KnowledgeDocument,
    KnowledgeGapCase,
    KnowledgeRevision,
    PolicyUpdateAssignment,
    PolicyUpdateAttempt,
)
from .provider import GenerationConfig, ProviderUnavailable, generate_claims
from .retrieval import retrieve
from .selectors import (
    manageable_documents,
    own_answers,
    policy_revision_for_case,
    require_active_actor,
    visible_gap_cases,
)


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
        "knowledge_check": document.draft_knowledge_check,
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


def _validate_knowledge_check(value):
    if not isinstance(value, dict):
        raise ValidationError({"draft_knowledge_check": "Add a question and three answer choices."})
    question = value.get("question")
    options = value.get("options")
    correct_option = value.get("correct_option")
    if not isinstance(question, str) or not 8 <= len(question.strip()) <= 600:
        raise ValidationError({"draft_knowledge_check": "Write a question between 8 and 600 characters."})
    if (
        not isinstance(options, list)
        or len(options) != 3
        or any(not isinstance(option, str) or not option.strip() or len(option) > 300 for option in options)
    ):
        raise ValidationError({"draft_knowledge_check": "Provide exactly three answer choices."})
    if type(correct_option) is not int or not 0 <= correct_option < len(options):
        raise ValidationError({"draft_knowledge_check": "Choose the correct answer."})
    explanation = value.get("explanation", "")
    if not isinstance(explanation, str) or len(explanation) > 1200:
        raise ValidationError({"draft_knowledge_check": "Keep the explanation below 1,200 characters."})
    return {
        "question": question.strip(),
        "options": [option.strip() for option in options],
        "correct_option": correct_option,
        "explanation": explanation.strip(),
    }


def _update_recipients(revision):
    roles = {
        "all": User.Role.values,
        "employee": [User.Role.EMPLOYEE],
        "manager": [User.Role.MANAGER],
        "hr": [User.Role.HR],
    }[revision.audience]
    recipients = Employee.objects.filter(
        is_active=True, user__is_active=True, user__role__in=roles
    )
    if revision.legal_entity_id:
        recipients = recipients.filter(legal_entity_id=revision.legal_entity_id)
    if revision.department_id:
        recipients = recipients.filter(department_id=revision.department_id)
    return recipients.select_related("user", "manager__user")


def _assign_policy_update(revision, user):
    if revision.previous_revision is None or not policy_text_changed(
        revision.previous_revision, revision
    ):
        return 0

    PolicyUpdateAssignment.objects.filter(
        revision__document_id=revision.document_id,
        status=PolicyUpdateAssignment.Status.PENDING,
    ).update(status=PolicyUpdateAssignment.Status.SUPERSEDED, superseded_at=timezone.now())

    assignments = [
        PolicyUpdateAssignment(revision=revision, employee=employee)
        for employee in _update_recipients(revision)
    ]
    PolicyUpdateAssignment.objects.bulk_create(assignments)
    event = emit(
        "knowledge.policy_update_assigned",
        "knowledge_revision",
        revision.id,
        {"assignment_count": len(assignments), "revision_number": revision.number},
        user,
    )
    for assignment in assignments:
        notify(
            assignment.employee.user,
            "policy_update_assigned",
            "Изменилось правило",
            f"Ознакомьтесь с редакцией {revision.number}: {revision.title}.",
            "policy_update",
            assignment.id,
            event,
        )
    manager_ids = {
        assignment.employee.manager.user_id
        for assignment in assignments
        if assignment.employee.manager_id
        and assignment.employee.manager.user_id
        and assignment.employee.manager.user_id != assignment.employee.user_id
        and assignment.employee.manager.user.is_active
        and assignment.employee.manager.user.role == User.Role.MANAGER
    }
    managers = User.objects.filter(pk__in=manager_ids).order_by("id")
    for manager in managers:
        notify(
            manager,
            "policy_update_team_assigned",
            "Новое правило для команды",
            f"Проверьте ознакомление команды с редакцией {revision.number}: {revision.title}.",
            "policy_update",
            revision.id,
            event,
        )
    return len(assignments)


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
    previous_revision = document.current_revision
    revision_values = {
        "document": document,
        "number": number,
        "published_by": user,
        "content_hash": content_hash,
        "previous_revision": previous_revision,
        **_snapshot(document),
    }
    candidate = KnowledgeRevision(**revision_values)
    if previous_revision and policy_text_changed(previous_revision, candidate):
        revision_values["knowledge_check"] = _validate_knowledge_check(
            document.draft_knowledge_check
        )
    revision = KnowledgeRevision.objects.create(**revision_values)
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
    _assign_policy_update(revision, user)
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
    PolicyUpdateAssignment.objects.filter(
        revision__document=document,
        status=PolicyUpdateAssignment.Status.PENDING,
    ).update(status=PolicyUpdateAssignment.Status.SUPERSEDED, superseded_at=timezone.now())
    emit(
        "knowledge.document_archived",
        "knowledge_document",
        document.id,
        {"version": document.version},
        user,
    )
    return document


@transaction.atomic
def submit_policy_update_answer(user, assignment_id, option_index, idempotency_key):
    employee = require_active_actor(user)
    if employee is None:
        raise NotFound()
    assignment = (
        PolicyUpdateAssignment.objects.select_for_update(of=("self",))
        .select_related("revision__document", "employee__manager__user")
        .filter(pk=assignment_id, employee=employee)
        .first()
    )
    if assignment is None:
        raise NotFound()
    if assignment.status != PolicyUpdateAssignment.Status.PENDING:
        raise Conflict("This policy update is no longer waiting for your answer.")
    revision = assignment.revision
    if revision.document.state != KnowledgeDocument.State.PUBLISHED:
        raise Conflict("This policy is no longer published. The assignment has been closed.")
    check = revision.knowledge_check
    if not isinstance(check, dict) or not 0 <= option_index < len(check.get("options", [])):
        raise Conflict("This policy check is no longer available.")

    is_correct = option_index == check["correct_option"]
    attempt = PolicyUpdateAttempt.objects.create(
        assignment=assignment,
        idempotency_key=idempotency_key,
        selected_option=option_index,
        is_correct=is_correct,
    )
    assignment.attempt_count += 1
    now = timezone.now()
    if is_correct:
        assignment.status = PolicyUpdateAssignment.Status.COMPLETED
        assignment.completed_at = now
    assignment.save(
        update_fields=["attempt_count", "status", "completed_at", "updated_at"]
    )
    event = emit(
        "knowledge.policy_update_answered",
        "knowledge_policy_update",
        assignment.id,
        {
            "attempt_id": str(attempt.id),
            "attempt_count": assignment.attempt_count,
            "completed": is_correct,
        },
        user,
    )
    if is_correct and assignment.employee.manager_id:
        manager = assignment.employee.manager
        if (
            manager.user_id
            and manager.user.is_active
            and manager.user.role == User.Role.MANAGER
        ):
            notify(
                manager.user,
                "policy_update_completed",
                "Сотрудник ознакомился с правилом",
                f"{assignment.employee.full_name} ответил на вопрос по редакции {revision.number}.",
                "policy_update",
                assignment.id,
                event,
            )
    return {
        "is_correct": is_correct,
        "completed": is_correct,
        "attempt_count": assignment.attempt_count,
        "completed_at": assignment.completed_at,
        "explanation": check.get("explanation", "") if is_correct else "",
    }


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
def resolve_gap_case(user, case_id, expected_version, response, published_revision_id=None):
    require_hr(user)
    case = visible_gap_cases(user).select_for_update(of=("self",)).filter(pk=case_id).first()
    if case is None:
        raise NotFound()
    require_hr(user, case.legal_entity_id)
    _check_version(case, expected_version)
    if case.status != KnowledgeGapCase.Status.OPEN:
        raise Conflict("This question is already resolved. Open the saved HR response.")
    if published_revision_id is not None:
        revision = policy_revision_for_case(user, case, published_revision_id)
        if revision is None:
            raise NotFound("Choose a published policy available to both you and the employee.")
        case.published_revision = revision
    case.response = response
    case.status = KnowledgeGapCase.Status.RESOLVED
    case.resolved_by = user
    case.resolved_at = timezone.now()
    case.version += 1
    case.save(
        update_fields=[
            "response",
            "status",
            "resolved_by",
            "resolved_at",
            "version",
            "updated_at",
            "published_revision",
        ]
    )
    event = emit(
        "knowledge.gap_resolved",
        "knowledge_gap",
        case.id,
        {
            "version": case.version,
            "published_revision_id": str(case.published_revision_id)
            if case.published_revision_id
            else None,
        },
        user,
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
