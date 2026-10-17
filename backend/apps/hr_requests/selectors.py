from decimal import Decimal

from django.db.models import Q, Sum

from apps.identity.models import User
from apps.identity.selectors import employee_for, visible_employees

from .models import HRRequest, LeaveBalanceIncorporation

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
