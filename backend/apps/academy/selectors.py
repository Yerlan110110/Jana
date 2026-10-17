from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Exists, F, OuterRef, Q
from django.utils import timezone

from apps.identity.selectors import employee_for, visible_employees

from .models import Course, Enrollment, QuizAttempt


def visible_courses(user):
    queryset = Course.objects.select_related("published_version__course", "legal_entity", "owner")
    if not user or not user.is_authenticated or not user.is_active:
        return queryset.none()
    if user.is_superuser:
        return queryset
    employee = employee_for(user)
    if employee is None:
        return queryset.none()
    return queryset.filter(legal_entity=employee.legal_entity)


def visible_enrollments(user):
    queryset = Enrollment.objects.filter(employee__in=visible_employees(user))
    if not user or not user.is_authenticated or not user.is_superuser:
        queryset = queryset.filter(
            course_version__course__legal_entity_id=F("employee__legal_entity_id")
        )
    return (
        queryset.select_related("employee__user", "course_version__course", "assigned_by")
        .prefetch_related("lesson_completions", "attempts")
        .annotate(
            has_failed_attempt=Exists(
                QuizAttempt.objects.filter(enrollment_id=OuterRef("pk"), passed=False)
            )
        )
    )


def enrollment_state(enrollment):
    if enrollment.completed_at:
        return "completed"
    return "in_progress" if enrollment.started_at else "not_started"


def material_progress(enrollment):
    completed_ids = {completion.lesson_id for completion in enrollment.lesson_completions.all()}
    required_ids = {
        lesson["id"] for lesson in enrollment.course_version.lessons if lesson["required"]
    }
    required_completed = len(completed_ids & required_ids)
    return {
        "completed_lesson_ids": sorted(completed_ids),
        "required_total": len(required_ids),
        "required_completed": required_completed,
        "percent": round(100 * required_completed / len(required_ids)) if required_ids else 0,
    }


def enrollment_actions(user, enrollment):
    if not user or enrollment.employee.user_id != user.pk or not enrollment.employee.is_active:
        return []
    if enrollment.course_version.course.availability != Course.Availability.PUBLISHED:
        return []
    if enrollment.completed_at:
        return []
    actions = ["complete_lesson"]
    if enrollment.started_at is None:
        actions.insert(0, "start")
    progress = material_progress(enrollment)
    attempt_count = len(enrollment.attempts.all())
    limit = enrollment.course_version.max_attempts
    if progress["required_total"] == progress["required_completed"] and (
        limit is None or attempt_count < limit
    ):
        actions.append("submit_attempt")
    return actions


def completion_filter(state):
    return {
        "not_started": Q(started_at__isnull=True, completed_at__isnull=True),
        "in_progress": Q(started_at__isnull=False, completed_at__isnull=True),
        "completed": Q(completed_at__isnull=False),
    }[state]


def enrollment_summary(queryset, *, now=None, scope="visible_enrollments_with_current_filters"):
    now = now or timezone.now()
    result = queryset.aggregate(
        total=Count("pk"),
        completed=Count("pk", filter=Q(completed_at__isnull=False)),
        in_progress=Count("pk", filter=Q(started_at__isnull=False, completed_at__isnull=True)),
        not_started=Count("pk", filter=Q(started_at__isnull=True, completed_at__isnull=True)),
        overdue=Count("pk", filter=Q(completed_at__isnull=True, due_at__lt=now)),
        required_outstanding=Count("pk", filter=Q(required=True, completed_at__isnull=True)),
        failed_enrollments=Count("pk", filter=Q(has_failed_attempt=True)),
        due_next_seven_days=Count(
            "pk",
            filter=Q(
                completed_at__isnull=True, due_at__gte=now, due_at__lte=now + timedelta(days=7)
            ),
        ),
    )
    result.update(
        has_failed_attempt=result.pop("failed_enrollments"),
        scope=scope,
        computed_at=now,
        completion_percent=(Decimal(result["completed"] * 100) / result["total"]).quantize(
            Decimal("0.01")
        )
        if result["total"]
        else None,
    )
    return result
