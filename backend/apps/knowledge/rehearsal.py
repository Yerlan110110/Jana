"""HR policy rehearsal.

Read-only preview of a draft document against the live retrieval corpus.
The after-corpus replaces only this document's current chunks with chunks
built in memory from the draft sections. Nothing is persisted: no
AssistantAnswer rows, events, notifications or version changes.
"""

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.identity.models import Employee
from apps.identity.permissions import require_hr
from apps.identity.selectors import employee_for

from .models import KnowledgeDocument, KnowledgeRevision
from .retrieval import rank_chunks
from .selectors import (
    accessible_chunks,
    accessible_documents,
    manageable_documents,
    require_active_actor,
    visible_gap_cases,
)
from .services import _check_version, _chunks, _snapshot, draft_hash

MAX_QUESTIONS = 10
SCOPE = "extractive_retrieval_comparison"


def _in_window(effective_from, effective_until):
    today = timezone.localdate()
    return effective_from <= today and (effective_until is None or effective_until > today)


def _scope_q(meta):
    condition = Q(is_active=True, user__is_active=True)
    if meta["legal_entity_id"] is not None:
        condition &= Q(legal_entity_id=meta["legal_entity_id"])
    if meta["department_id"] is not None:
        condition &= Q(department_id=meta["department_id"])
    if meta["audience"] != "all":
        condition &= Q(user__role=meta["audience"])
    return condition


def _eligible_ids(meta):
    if not _in_window(meta["effective_from"], meta["effective_until"]):
        return set()
    return set(Employee.objects.filter(_scope_q(meta)).values_list("id", flat=True))


def _draft_accessible(document, actor, language):
    """Mirror scope_filter, effective_filter and the language filter on draft fields."""
    if not actor.is_superuser:
        employee = employee_for(actor)
        if employee is None:
            return False
        if (
            document.legal_entity_id is not None
            and document.legal_entity_id != employee.legal_entity_id
        ):
            return False
        if document.department_id is not None and document.department_id != employee.department_id:
            return False
        if document.audience not in {"all", actor.role}:
            return False
    if not _in_window(document.effective_from, document.effective_until):
        return False
    return document.language == language


def _evidence_key(result):
    return tuple(
        (str(item.chunk.revision.document_id), item.chunk.content_hash) for item in result.chunks
    )


def _classify(before, after):
    if not before.chunks and not after.chunks:
        return "unchanged"
    if not before.chunks:
        return "gained"
    if not after.chunks:
        return "lost"
    return "unchanged" if _evidence_key(before) == _evidence_key(after) else "changed"


def _visible_retrieval(result, allowed_document_ids):
    """Present ranked chunks the caller may see, counting the rest.

    Gap-case questions are ranked under the employee's scope. An employee can
    read documents HR can neither read nor manage, such as a global
    employee-audience policy. Their text must not reach the HR response.
    """
    excerpts = []
    restricted = 0
    for item in result.chunks:
        chunk = item.chunk
        allowed = getattr(chunk, "_is_draft", False) or (
            chunk.revision.document_id in allowed_document_ids
        )
        if allowed:
            excerpts.append(_excerpt(item))
        else:
            restricted += 1
    return {
        "reason": result.reason,
        "excerpts": excerpts,
        "restricted_excerpts": restricted,
    }


def _excerpt(item):
    chunk = item.chunk
    revision = chunk.revision
    is_draft = getattr(chunk, "_is_draft", False)
    return {
        "origin": "draft" if is_draft else "published",
        "chunk_id": None if is_draft else chunk.id,
        "revision_id": None if is_draft else revision.id,
        "revision_number": None if is_draft else revision.number,
        "document_id": revision.document_id,
        "title": revision.title,
        "heading": chunk.heading,
        "locator": chunk.locator,
        "text": chunk.text,
        "content_hash": chunk.content_hash,
        "score": item.score,
        "coverage": item.coverage,
    }


def _draft_chunks(document, user):
    revision = KnowledgeRevision(
        document=document,
        number=0,
        published_by=user,
        content_hash=draft_hash(document),
        **_snapshot(document),
    )
    chunks = list(_chunks(revision))
    for chunk in chunks:
        chunk._is_draft = True
    return chunks


def _scoped_cases(user, gap_case_ids):
    base = visible_gap_cases(user).filter(employee__is_active=True, employee__user__is_active=True)
    if gap_case_ids:
        cases = list(base.filter(pk__in=gap_case_ids))
        if len({case.pk for case in cases}) != len(set(gap_case_ids)):
            raise NotFound("One or more requested questions are not available to you.")
        order = {pk: index for index, pk in enumerate(gap_case_ids)}
        return sorted(cases, key=lambda case: order[case.pk])
    return list(base.order_by("-created_at")[:MAX_QUESTIONS])


def rehearse_document(
    user,
    document_id,
    *,
    expected_version,
    questions=(),
    gap_case_ids=(),
    language=None,
):
    require_active_actor(user)
    require_hr(user)
    document = (
        manageable_documents(user).select_related("current_revision").filter(pk=document_id).first()
    )
    if document is None:
        raise NotFound()
    _check_version(document, expected_version)
    if document.state == KnowledgeDocument.State.ARCHIVED:
        raise ValidationError(
            {"document": ["An archived document is not retrievable. Nothing to rehearse."]}
        )
    if not document.draft_sections:
        raise ValidationError({"draft_sections": ["Add draft sections before rehearsing."]})

    if gap_case_ids:
        cases = _scoped_cases(user, gap_case_ids)
    elif not questions:
        cases = _scoped_cases(user, ())
    else:
        cases = []

    explicit_language = language or document.language
    items = [("explicit", None, user, question, explicit_language) for question in questions]
    for case in cases:
        items.append(("gap_case", case, case.employee.user, case.question, case.answer.language))
    if not items:
        raise ValidationError(
            {"questions": ["Provide explicit questions or pick scoped employee questions."]}
        )
    if len(items) > MAX_QUESTIONS:
        raise ValidationError(
            {"questions": [f"A rehearsal compares at most {MAX_QUESTIONS} questions."]}
        )

    draft_chunks = _draft_chunks(document, user)
    allowed_document_ids = set(accessible_documents(user).values_list("id", flat=True)) | set(
        manageable_documents(user).values_list("id", flat=True)
    )
    corpus_cache = {}
    results = []
    summary = {"unchanged": 0, "changed": 0, "lost": 0, "gained": 0}
    impacted_employees = set()
    for source, case, actor, question, question_language in items:
        key = (actor.pk, question_language)
        if key not in corpus_cache:
            corpus_cache[key] = list(
                accessible_chunks(actor, current_only=True, language=question_language)
            )
        current_chunks = corpus_cache[key]
        before = rank_chunks(current_chunks, question, question_language)
        after_candidates = [
            chunk for chunk in current_chunks if chunk.revision.document_id != document.pk
        ]
        if _draft_accessible(document, actor, question_language):
            after_candidates += draft_chunks
        after = rank_chunks(after_candidates, question, question_language)
        classification = _classify(before, after)
        summary[classification] += 1
        if case is not None and classification != "unchanged":
            impacted_employees.add(case.employee_id)
        results.append(
            {
                "source": source,
                "gap_case_id": case.pk if case is not None else None,
                "question": question,
                "language": question_language,
                "classification": classification,
                "before": _visible_retrieval(before, allowed_document_ids),
                "after": _visible_retrieval(after, allowed_document_ids),
            }
        )

    draft_meta = _snapshot(document)
    draft_ids = _eligible_ids(draft_meta)
    if document.current_revision_id:
        revision = document.current_revision
        current_meta = {
            "legal_entity_id": revision.legal_entity_id,
            "department_id": revision.department_id,
            "audience": revision.audience,
            "effective_from": revision.effective_from,
            "effective_until": revision.effective_until,
        }
        current_ids = _eligible_ids(current_meta)
        eligible_current = len(current_ids)
    else:
        current_ids = set()
        eligible_current = None
    has_unpublished_changes = (
        document.current_revision_id is None
        or document.current_revision.content_hash != draft_hash(document)
    )
    return {
        "document": {
            "id": document.id,
            "slug": document.slug,
            "title": document.title,
            "state": document.state,
            "version": document.version,
            "has_unpublished_changes": has_unpublished_changes,
        },
        "current": {
            "revision_id": document.current_revision_id,
            "revision_number": document.current_revision.number,
            "content_hash": document.current_revision.content_hash,
            "published_at": document.current_revision.published_at,
        }
        if document.current_revision_id
        else None,
        "draft": {
            "content_hash": draft_hash(document),
            "language": document.language,
            "topic": document.topic,
            "audience": document.audience,
            "effective_from": document.effective_from,
            "effective_until": document.effective_until,
            "section_count": len(document.draft_sections),
        },
        "audience_impact": {
            "eligible_current": eligible_current,
            "eligible_draft": len(draft_ids),
            "changed": len(current_ids ^ draft_ids),
        },
        "summary": {"total": len(results), **summary},
        "impacted_employees_count": len(impacted_employees),
        "results": results,
        "scope": SCOPE,
        "not_legal_verification": True,
    }
