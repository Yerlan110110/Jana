from decimal import Decimal

from django.db.models import Q, Sum

from apps.core.models import OutboxMessage
from apps.identity.models import User
from apps.identity.selectors import employee_for, visible_employees
from apps.integrations.selectors import EXPORT_TOPIC

from .models import HRRequest, LeaveBalanceIncorporation

WAITING_STATUSES = (HRRequest.Status.PENDING_MANAGER, HRRequest.Status.PENDING_HR)

RESERVING_STATUSES = [
    HRRequest.Status.PENDING_MANAGER,
    HRRequest.Status.PENDING_HR,
    HRRequest.Status.APPROVED,
]


def visible_requests(user):
    return HRRequest.objects.filter(employee__in=visible_employees(user)).select_related(
        "employee__user",
        "employee__legal_entity",
        "assigned_manager__user",
    )


def review_requests(user):
    employee = employee_for(user)
    if employee is None and not user.is_superuser:
        return HRRequest.objects.none()
    queryset = visible_requests(user).filter(employee__is_active=True).exclude(employee=employee)
    if user.is_superuser:
        return queryset.filter(
            status__in=[HRRequest.Status.PENDING_MANAGER, HRRequest.Status.PENDING_HR]
        )
    assigned = Q(status=HRRequest.Status.PENDING_MANAGER, assigned_manager=employee)
    if user.role == User.Role.HR:
        return queryset.filter(assigned | Q(status=HRRequest.Status.PENDING_HR))
    if user.role == User.Role.MANAGER:
        return queryset.filter(assigned, employee__manager=employee)
    return queryset.none()


def leave_projection(employee, exclude_request=None):
    queryset = HRRequest.objects.filter(
        employee=employee, kind=HRRequest.Kind.LEAVE, status__in=RESERVING_STATUSES
    )
    if exclude_request:
        queryset = queryset.exclude(pk=exclude_request)
    incorporated = queryset.filter(
        status=HRRequest.Status.APPROVED,
        balance_incorporation__state=LeaveBalanceIncorporation.State.INCORPORATED,
    )
    accounted = incorporated.aggregate(total=Sum("leave_days"))["total"] or Decimal("0.00")
    queryset = queryset.exclude(pk__in=incorporated.values("pk"))
    reserved = queryset.aggregate(total=Sum("leave_days"))["total"] or Decimal("0.00")
    return {
        "official_balance": employee.leave_balance,
        "portal_reserved_days": reserved,
        "source_incorporated_days": accounted,
        "projected_balance": employee.leave_balance - reserved,
        "balance_as_of": employee.balance_as_of,
        "day_count_convention": "calendar_days_inclusive_demo",
    }


def fulfillment_for(request):
    revision = request.revisions.filter(number=request.submission_number).first()
    message = (
        OutboxMessage.objects.filter(
            topic=EXPORT_TOPIC,
            event__requesthistory__request=request,
            event__requesthistory__submission_number=request.submission_number,
            event__requesthistory__to_status=HRRequest.Status.APPROVED,
        )
        .select_related("export_receipt")
        .first()
    )
    receipt = getattr(message, "export_receipt", None)
    delivery = "not_queued"
    accepted_at = None
    if message:
        if receipt and revision and receipt.request_revision_id == revision.pk:
            delivery, accepted_at = "accepted", receipt.accepted_at
        elif message.status in {OutboxMessage.Status.FAILED, OutboxMessage.Status.PROCESSED}:
            delivery = "needs_operator"
        else:
            delivery = "queued"
    incorporation = None
    if request.kind == HRRequest.Kind.LEAVE and revision:
        incorporation = LeaveBalanceIncorporation.objects.filter(
            request=request, request_revision=revision
        ).first()
    return {
        "request_id": request.pk,
        "approval": {
            "status": request.status,
            "submitted_revision_id": revision.pk if revision else None,
            "submission_number": request.submission_number,
        },
        "delivery": {"state": delivery, "accepted_at": accepted_at},
        "source_accounting": {
            "state": "not_applicable"
            if request.kind != HRRequest.Kind.LEAVE
            else (incorporation.state if incorporation else "not_confirmed"),
            "source_revision": incorporation.source_revision if incorporation else None,
            "confirmed_at": incorporation.confirmed_at if incorporation else None,
            "balance_as_of": request.employee.balance_as_of
            if request.kind == HRRequest.Kind.LEAVE
            else None,
        },
    }
