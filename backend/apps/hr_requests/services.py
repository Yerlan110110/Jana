from decimal import Decimal

from django.core.exceptions import ValidationError as ModelValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.core.errors import Conflict
from apps.core.events import emit
from apps.core.models import OutboxMessage
from apps.identity.models import Employee, User
from apps.identity.permissions import can_manage_employee
from apps.identity.selectors import employee_for
from apps.notifications.services import notify

from .models import HRRequest, RequestHistory, RequestRevision
from .selectors import RESERVING_STATUSES, leave_projection, visible_requests

EDITABLE = {HRRequest.Status.DRAFT, HRRequest.Status.RETURNED}
PENDING = {HRRequest.Status.PENDING_MANAGER, HRRequest.Status.PENDING_HR}
OWNER_CANCELLABLE = EDITABLE | PENDING


def _can_review(user, request):
    if request.status not in PENDING or not can_manage_employee(user, request.employee):
        return False
    if user.is_superuser:
        return True
    if request.status == HRRequest.Status.PENDING_HR:
        return user.role == User.Role.HR
    return bool(request.assigned_manager_id and request.assigned_manager.user_id == user.pk)


def allowed_actions(user, request):
    if not user or not user.is_authenticated or not user.is_active:
        return []
    actions = []
    if request.employee.user_id == user.pk and request.employee.is_active:
        if request.status in EDITABLE:
            actions.extend(["update_draft", "submit"])
        if request.status in OWNER_CANCELLABLE:
            actions.append("cancel")
    if _can_review(user, request):
        actions.extend(["approve", "reject", "return_for_changes"])
    return actions


def _locked_request(user, request_id):
    initial = visible_requests(user).filter(pk=request_id).first()
    if initial is None:
        raise NotFound()
    Employee.objects.select_for_update().get(pk=initial.employee_id)
    result = visible_requests(user).select_for_update(of=("self",)).filter(pk=request_id).first()
    if result is None:
        raise NotFound()
    return result


def _expect_version(request, expected_version):
    if request.version != expected_version:
        raise Conflict(
            f"Expected version {expected_version}; current version is {request.version}."
        )


def _require_action(user, request, action):
    if action not in allowed_actions(user, request):
        raise PermissionDenied(
            "This action is not permitted for your role and the current request state."
        )


def validate_details(kind, values):
    if kind == HRRequest.Kind.LEAVE:
        if any(
            values.get(field) not in (None, "")
            for field in ["amount", "currency", "requested_payment_date"]
        ):
            raise ValidationError("A leave request cannot include salary-advance fields.")
        start, end = values.get("start_date"), values.get("end_date")
        if start is None or end is None:
            raise ValidationError({"start_date": "Start and end dates are required."})
        if end < start:
            raise ValidationError({"end_date": "End date cannot precede start date."})
        days = Decimal((end - start).days + 1)
        try:
            HRRequest._meta.get_field("leave_days").run_validators(days)
        except ModelValidationError as error:
            raise ValidationError({"end_date": "The date range is too large."}) from error
        values["leave_days"] = days
        values["amount"] = None
        values["currency"] = ""
        values["requested_payment_date"] = None
    elif kind == HRRequest.Kind.ADVANCE:
        if any(values.get(field) is not None for field in ["start_date", "end_date", "leave_days"]):
            raise ValidationError("A salary advance cannot include leave fields.")
        if values.get("amount") is None or values["amount"] <= 0:
            raise ValidationError({"amount": "A positive amount is required."})
        if values.get("requested_payment_date") is None:
            raise ValidationError(
                {"requested_payment_date": "A requested payment date is required."}
            )
        if values.get("currency", "KZT") != "KZT":
            raise ValidationError(
                {"currency": "The demonstration salary-advance process uses KZT."}
            )
        values["currency"] = "KZT"
        values["start_date"] = values["end_date"] = values["leave_days"] = None
    else:
        raise ValidationError({"kind": "Unknown request kind."})
    return values


def _record(user, request, action, previous_status, comment=""):
    caller = employee_for(user)
    event = emit(
        f"hr_request.{action}",
        "hr_request",
        request.pk,
        {
            "request_id": str(request.pk),
            "employee_id": str(request.employee_id),
            "kind": request.kind,
            "from_status": previous_status,
            "status": request.status,
            "version": request.version,
            "submission_number": request.submission_number,
        },
        actor=user,
    )
    RequestHistory.objects.create(
        request=request,
        actor=user,
        actor_name=caller.full_name if caller else user.username,
        action=action,
        from_status=previous_status,
        to_status=request.status,
        version=request.version,
        comment=comment,
        submission_number=request.submission_number,
        event=event,
    )
    if action not in {"created", "edited"}:
        notify(
            request.employee.user,
            "request_status",
            "Статус заявки изменился",
            f"Заявка: {request.get_status_display()}",
            "hr_request",
            request.pk,
            event,
        )
    if request.status == HRRequest.Status.PENDING_MANAGER and action == "submitted":
        notify(
            request.assigned_manager.user,
            "request_review",
            "Новая заявка на согласование",
            request.employee.full_name,
            "hr_request",
            request.pk,
            event,
        )
    if request.status == HRRequest.Status.PENDING_HR and action in {"submitted", "approved"}:
        reviewers = User.objects.filter(
            role=User.Role.HR,
            is_active=True,
            employee__is_active=True,
            employee__legal_entity=request.employee.legal_entity,
        ).exclude(pk=request.employee.user_id)
        for reviewer in reviewers:
            notify(
                reviewer,
                "request_review",
                "Заявка ожидает HR",
                request.employee.full_name,
                "hr_request",
                request.pk,
                event,
            )
    if request.status == HRRequest.Status.APPROVED and action == "approved":
        OutboxMessage.objects.create(event=event, topic="documentolog.export_request")
    return request


@transaction.atomic
def create(user, values, *, request_id=None):
    employee = employee_for(user)
    if employee is None:
        raise PermissionDenied("An active employee profile is required.")
    employee = Employee.objects.select_for_update().get(pk=employee.pk)
    values = dict(values)
    kind = values.pop("kind")
    validate_details(kind, values)
    allowed = {
        "reason",
        "start_date",
        "end_date",
        "leave_days",
        "amount",
        "currency",
        "requested_payment_date",
    }
    if values.keys() - allowed:
        raise ValidationError("Only request details can be set when creating a request.")
    identity = {"id": request_id} if request_id else {}
    request = HRRequest.objects.create(employee=employee, kind=kind, **values, **identity)
    return _record(user, request, "created", "")


@transaction.atomic
def update_draft(user, request_id, expected_version, values):
    request = _locked_request(user, request_id)
    _expect_version(request, expected_version)
    _require_action(user, request, "update_draft")
    fields = [
        "reason",
        "start_date",
        "end_date",
        "amount",
        "currency",
        "requested_payment_date",
        "leave_days",
    ]
    if values.keys() - (set(fields) - {"leave_days"}):
        raise ValidationError("Only editable request details can be changed.")
    combined = {field: getattr(request, field) for field in fields}
    combined.update(values)
    validate_details(request.kind, combined)
    for field, value in combined.items():
        setattr(request, field, value)
    request.version += 1
    request.save()
    return _record(user, request, "edited", request.status)


def _validate_submission(request, *, check_dates=True):
    today = timezone.localdate()
    if request.kind == HRRequest.Kind.LEAVE:
        if check_dates and request.start_date < today:
            raise ValidationError(
                {"start_date": "The demonstration policy requires a current or future start date."}
            )
        if (
            HRRequest.objects.filter(
                employee=request.employee,
                kind=HRRequest.Kind.LEAVE,
                status__in=RESERVING_STATUSES,
                start_date__lte=request.end_date,
                end_date__gte=request.start_date,
            )
            .exclude(pk=request.pk)
            .exists()
        ):
            raise Conflict("The requested dates overlap an active leave request.")
        if (
            request.leave_days
            > leave_projection(request.employee, exclude_request=request.pk)["projected_balance"]
        ):
            raise ValidationError(
                {"start_date": "The requested leave exceeds the projected balance."}
            )
    elif check_dates and request.requested_payment_date < today:
        raise ValidationError(
            {"requested_payment_date": "The requested payment date cannot be in the past."}
        )


def _snapshot(request):
    return {
        "kind": request.kind,
        "reason": request.reason,
        "employee_id": str(request.employee_id),
        "employee_name": request.employee.full_name,
        "employee_external_id": request.employee.external_id,
        "legal_entity_id": str(request.employee.legal_entity_id),
        "department_id": str(request.employee.department_id),
        "start_date": request.start_date.isoformat() if request.start_date else None,
        "end_date": request.end_date.isoformat() if request.end_date else None,
        "leave_days": str(request.leave_days) if request.leave_days is not None else None,
        "amount": str(request.amount) if request.amount is not None else None,
        "currency": request.currency,
        "requested_payment_date": request.requested_payment_date.isoformat()
        if request.requested_payment_date
        else None,
        "assigned_manager_id": str(request.assigned_manager_id)
        if request.assigned_manager_id
        else None,
        "policy": "synthetic_manager_then_hr_v1",
        "day_count_convention": "calendar_days_inclusive_demo",
    }


@transaction.atomic
def submit(user, request_id, expected_version):
    request = _locked_request(user, request_id)
    _expect_version(request, expected_version)
    _require_action(user, request, "submit")
    _validate_submission(request)
    previous = request.status
    manager = request.employee.manager
    if manager and (
        not manager.is_active
        or not manager.user.is_active
        or manager.user.role not in {User.Role.MANAGER, User.Role.HR}
    ):
        raise Conflict(
            "The assigned manager cannot review requests. HR must resolve the organization data."
        )
    request.assigned_manager = manager
    request.status = HRRequest.Status.PENDING_MANAGER if manager else HRRequest.Status.PENDING_HR
    request.version += 1
    request.submission_number += 1
    request.submitted_at = timezone.now()
    request.save()
    RequestRevision.objects.create(
        request=request,
        number=request.submission_number,
        payload=_snapshot(request),
        assigned_manager=manager,
    )
    return _record(user, request, "submitted", previous)


@transaction.atomic
def decide(user, request_id, expected_version, action, comment=""):
    if action not in {"approve", "reject", "return_for_changes"}:
        raise ValidationError("Unknown decision.")
    request = _locked_request(user, request_id)
    _expect_version(request, expected_version)
    _require_action(user, request, action)
    if action in {"reject", "return_for_changes"} and not comment.strip():
        raise ValidationError({"comment": "Explain the rejection or requested changes."})
    previous = request.status
    if action == "approve":
        _validate_submission(request, check_dates=False)
        request.status = (
            HRRequest.Status.PENDING_HR
            if previous == HRRequest.Status.PENDING_MANAGER
            else HRRequest.Status.APPROVED
        )
        event_action = "approved"
    else:
        request.status = (
            HRRequest.Status.REJECTED if action == "reject" else HRRequest.Status.RETURNED
        )
        event_action = "rejected" if action == "reject" else "returned"
    request.version += 1
    request.save()
    return _record(user, request, event_action, previous, comment)


@transaction.atomic
def cancel(user, request_id, expected_version):
    request = _locked_request(user, request_id)
    _expect_version(request, expected_version)
    _require_action(user, request, "cancel")
    previous = request.status
    request.status = HRRequest.Status.CANCELLED
    request.version += 1
    request.save()
    return _record(user, request, "cancelled", previous)
