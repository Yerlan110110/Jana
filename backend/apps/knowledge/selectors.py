from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.identity.models import User
from apps.identity.selectors import employee_for

from .models import AssistantAnswer, KnowledgeChunk, KnowledgeDocument, KnowledgeGapCase


def require_active_actor(user):
    if not user or not user.is_authenticated or not user.is_active:
        raise PermissionDenied("Sign in with an active employee account.")
    employee = employee_for(user)
    if employee is None and not user.is_superuser:
        raise PermissionDenied("Your employee profile is inactive. Contact HR to restore access.")
    return employee


def scope_filter(user, prefix=""):
    employee = require_active_actor(user)
    if user.is_superuser:
        return Q()
    return (
        (
            Q(**{f"{prefix}legal_entity__isnull": True})
            | Q(**{f"{prefix}legal_entity_id": employee.legal_entity_id})
        )
        & (
            Q(**{f"{prefix}department__isnull": True})
            | Q(**{f"{prefix}department_id": employee.department_id})
        )
        & Q(**{f"{prefix}audience__in": ["all", user.role]})
    )


def effective_filter(prefix=""):
    today = timezone.localdate()
    return Q(**{f"{prefix}effective_from__lte": today}) & (
        Q(**{f"{prefix}effective_until__isnull": True})
        | Q(**{f"{prefix}effective_until__gt": today})
    )


def accessible_documents(user):
    return (
        KnowledgeDocument.objects.filter(state=KnowledgeDocument.State.PUBLISHED)
        .filter(scope_filter(user, "current_revision__"))
        .filter(effective_filter("current_revision__"))
        .select_related(
            "current_revision__owner",
            "current_revision__legal_entity",
            "current_revision__department",
        )
    )


def manageable_documents(user):
    employee = require_active_actor(user)
    documents = KnowledgeDocument.objects.select_related(
        "owner", "legal_entity", "department", "current_revision"
    )
    if user.is_superuser:
        return documents
    if user.role != User.Role.HR:
        return documents.none()
    return documents.filter(legal_entity_id=employee.legal_entity_id)


def accessible_chunks(user, *, current_only=False, language=None):
    documents = accessible_documents(user)
    chunks = KnowledgeChunk.objects.filter(revision__document__in=documents).filter(
        scope_filter(user, "revision__"), effective_filter("revision__")
    )
    if current_only:
        chunks = chunks.filter(revision_id__in=documents.values("current_revision_id"))
    if language:
        chunks = chunks.filter(revision__language=language)
    return chunks.select_related("revision__document", "revision__owner")


def own_answers(user):
    require_active_actor(user)
    return AssistantAnswer.objects.filter(user=user)


def visible_gap_cases(user):
    employee = require_active_actor(user)
    cases = KnowledgeGapCase.objects.select_related("employee__user", "answer", "resolved_by")
    if user.is_superuser:
        return cases
    if user.role == User.Role.HR:
        return cases.filter(legal_entity_id=employee.legal_entity_id)
    return cases.filter(employee=employee)
