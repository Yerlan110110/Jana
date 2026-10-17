from decimal import Decimal

from django.db.models import Sum

from apps.identity.selectors import visible_employees

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
