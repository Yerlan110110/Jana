from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.identity.models import User
from apps.identity.selectors import employee_for

from .models import (
    AssistantAnswer,
    KnowledgeChunk,
    KnowledgeDocument,
    KnowledgeGapCase,
    KnowledgeRevision,
    PolicyUpdateAssignment,
)


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


def accessible_revisions(user):
    return (
        KnowledgeRevision.objects.filter(document__in=accessible_documents(user))
        .filter(scope_filter(user), effective_filter())
        .select_related("document", "owner", "legal_entity", "department")
    )


def accessible_chunks(user, *, current_only=False, language=None):
    revisions = accessible_revisions(user)
    if current_only:
        revisions = revisions.filter(
            pk__in=accessible_documents(user).values("current_revision_id")
        )
    if language:
        revisions = revisions.filter(language=language)
    return KnowledgeChunk.objects.filter(revision__in=revisions).select_related(
        "revision__document", "revision__owner"
    )


def policy_revision_for_case(user, case, revision_id):
    try:
        owner_revisions = accessible_revisions(case.employee.user)
    except PermissionDenied:
        return None
    return (
        accessible_revisions(user)
        .filter(pk=revision_id, pk__in=owner_revisions.values("pk"))
        .first()
    )


def own_answers(user):
    require_active_actor(user)
    return AssistantAnswer.objects.filter(user=user)


def visible_gap_cases(user):
    employee = require_active_actor(user)
    cases = KnowledgeGapCase.objects.select_related(
        "employee__user", "answer", "resolved_by", "published_revision__document"
    )
    if user.is_superuser:
        return cases
    if user.role == User.Role.HR:
        return cases.filter(legal_entity_id=employee.legal_entity_id)
    return cases.filter(employee=employee)


def visible_policy_updates(user):
    require_active_actor(user)
    from apps.identity.selectors import visible_employees

    return (
        PolicyUpdateAssignment.objects.filter(employee__in=visible_employees(user))
        .select_related("revision__document", "revision__previous_revision", "employee__user")
        .order_by("-revision__published_at", "employee__full_name", "id")
    )


def own_policy_update(user, assignment_id):
    employee = require_active_actor(user)
    if employee is None:
        raise PermissionDenied("An active employee profile is required.")
    assignment = (
        PolicyUpdateAssignment.objects.select_related(
            "revision__document", "revision__previous_revision", "employee__manager__user"
        )
        .filter(pk=assignment_id, employee=employee)
        .first()
    )
    if assignment is None:
        return None
    if assignment.status == PolicyUpdateAssignment.Status.SUPERSEDED:
        return assignment
    revision = assignment.revision
    accessible = (
        accessible_documents(user)
        .filter(pk=revision.document_id)
        .exists()
        and KnowledgeRevision.objects.filter(pk=revision.pk)
        .filter(scope_filter(user), effective_filter())
        .exists()
    )
    if not accessible:
        return None
    return assignment
