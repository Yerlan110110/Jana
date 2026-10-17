from django.db.models import Case, F, Value, When
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.academy.models import Course
from apps.academy.selectors import enrollment_summary, visible_enrollments
from apps.hr_requests.models import HRRequest
from apps.hr_requests.selectors import leave_projection, review_requests, visible_requests
from apps.identity.models import User
from apps.identity.selectors import employee_for
from apps.knowledge.models import KnowledgeGapCase
from apps.knowledge.selectors import visible_gap_cases
from apps.notifications.models import Notification


def preview(queryset, limit):
    return {"count": queryset.count(), "results": list(queryset[:limit])}


def workbench_for(user, *, preview_limit=5):
    employee = employee_for(user)
    if employee is None:
        raise PermissionDenied("An active employee profile is required for the workbench.")
    now = timezone.now()
    own_requests = visible_requests(user).filter(employee=employee)
    learning = visible_enrollments(user).filter(employee=employee)
    outstanding = learning.filter(completed_at__isnull=True)
    available = outstanding.filter(
        course_version__course__availability=Course.Availability.PUBLISHED
    ).annotate(
        attention_order=Case(
            When(due_at__lt=now, then=Value(0)),
            When(required=True, then=Value(1)),
            default=Value(2),
        )
    )
    return {
        "computed_at": now,
        "preview_limit": preview_limit,
        "employee": employee,
        "leave": leave_projection(employee),
        "learning_summary": enrollment_summary(learning, now=now, scope="self"),
        "returned_requests": preview(
            own_requests.filter(status=HRRequest.Status.RETURNED).order_by("updated_at", "id"),
            preview_limit,
        ),
        "draft_requests": preview(
            own_requests.filter(status=HRRequest.Status.DRAFT).order_by("created_at", "id"),
            preview_limit,
        ),
        "requests_to_review": preview(
            review_requests(user).order_by("submitted_at", "id"), preview_limit
        ),
        "waiting_request_count": own_requests.filter(
            status__in=[HRRequest.Status.PENDING_MANAGER, HRRequest.Status.PENDING_HR]
        ).count(),
        "learning_outstanding": preview(
            available.order_by("attention_order", F("due_at").asc(nulls_last=True), "id"),
            preview_limit,
        ),
        "unavailable_learning_count": outstanding.exclude(
            course_version__course__availability=Course.Availability.PUBLISHED
        ).count(),
        "open_knowledge_cases": preview(
            visible_gap_cases(user)
            .filter(status=KnowledgeGapCase.Status.OPEN)
            .order_by("created_at", "id"),
            preview_limit,
        ),
        "knowledge_case_purpose": "hr_response"
        if user.role == User.Role.HR or user.is_superuser
        else "track_own",
        "unread_notification_count": Notification.objects.filter(
            recipient=user, read_at__isnull=True
        ).count(),
    }
