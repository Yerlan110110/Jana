from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.errors import Conflict
from apps.core.events import emit
from apps.hr_requests.models import HRRequest, LeaveBalanceIncorporation, RequestRevision
from apps.identity.models import Department, Employee, User

from .contracts import ImportSnapshot, payload_hash
from .models import EmployeeImportState, EntitySyncState, SourceImportBatch
from .permissions import require_operator_entity


@dataclass(frozen=True)
class ImportOutcome:
    batch: SourceImportBatch
    http_status: int
    source_replayed: bool = False


def _first_error(detail):
    if isinstance(detail, list):
        return _first_error(detail[0])
    if isinstance(detail, dict):
        return _first_error(next(iter(detail.values())))
    return str(detail)


def _invalid_record(index, field, message):
    raise ValidationError({"employees": {str(index): {field: [message]}}})


def _manager_graph(employees):
    complete = set()
    for employee in employees.values():
        path = set()
        current = employee
        while current is not None and current.pk not in complete:
            if current.pk in path:
                raise ValidationError("Remove the manager cycle from the complete source batch.")
            path.add(current.pk)
            if current.manager_id is not None:
                manager = employees.get(current.manager_id)
                if manager is None:
                    raise ValidationError("Choose a manager from the same legal entity.")
                if current.is_active and (
                    not manager.is_active
                    or not manager.user.is_active
                    or manager.user.role not in {User.Role.MANAGER, User.Role.HR}
                ):
                    raise ValidationError(
                        "Active employees require an active manager with review permission."
                    )
                current = manager
            else:
                current = None
        complete.update(path)


def _balance_changes(employee, snapshot):
    confirmations = set(snapshot.incorporated_request_ids)
    reversals = {item.request_id: item.reason for item in snapshot.balance_reversals}
    existing = {
        item.request_id: item
        for item in LeaveBalanceIncorporation.objects.filter(request__employee=employee)
    }
    active = {
        request_id
        for request_id, item in existing.items()
        if item.state == LeaveBalanceIncorporation.State.INCORPORATED
    }
    if active - confirmations - reversals.keys():
        raise Conflict(
            "Reaffirm every incorporated request or provide an explicit balance reversal and reason."
        )
    if reversals.keys() - active:
        raise ValidationError("A balance reversal must refer to a currently incorporated request.")
    wanted = confirmations | reversals.keys()
    requests = {
        item.pk: item
        for item in HRRequest.objects.filter(
            pk__in=wanted,
            employee=employee,
            kind=HRRequest.Kind.LEAVE,
            status=HRRequest.Status.APPROVED,
        )
    }
    if requests.keys() != wanted:
        raise ValidationError(
            "Confirm only approved leave requests belonging to this source employee."
        )
    changes = []
    for request_id in sorted(wanted, key=str):
        request = requests[request_id]
        revision = RequestRevision.objects.get(request=request, number=request.submission_number)
        recorded_days = revision.payload.get("leave_days")
        if (
            recorded_days is None
            or Decimal(recorded_days) != request.leave_days
            or revision.payload.get("employee_id") != str(employee.pk)
            or revision.payload.get("legal_entity_id") != str(employee.legal_entity_id)
            or revision.payload.get("kind") != HRRequest.Kind.LEAVE
        ):
            raise Conflict(
                "Resolve the request's submitted evidence before reconciling its leave balance."
            )
        old = existing.get(request_id)
        if old and (old.request_revision_id != revision.pk or old.leave_days != request.leave_days):
            raise Conflict("The previously reconciled request revision has changed.")
        changes.append(
            {
                "request": request,
                "request_revision": revision,
                "leave_days": request.leave_days,
                "state": LeaveBalanceIncorporation.State.INCORPORATED
                if request_id in confirmations
                else LeaveBalanceIncorporation.State.REVERSED,
            }
        )
    return changes


def _apply_snapshot(user, entity, state, snapshot, canonical, digest):
    previous = SourceImportBatch.objects.filter(
        legal_entity=entity,
        source=snapshot.source,
        source_revision=snapshot.source_revision,
        status=SourceImportBatch.Status.ACCEPTED,
    ).first()
    if previous:
        if previous.payload_hash != digest:
            raise Conflict("This accepted source revision already identifies different data.")
        return ImportOutcome(previous, 200, source_replayed=True)
    if snapshot.source_revision <= state.last_revision:
        raise Conflict("Import a newer source revision. The accepted snapshot was preserved.")
    if state.last_captured_at and snapshot.captured_at < state.last_captured_at:
        raise Conflict("The source capture time cannot precede the last accepted capture.")

    employees = {
        employee.pk: employee
        for employee in Employee.objects.filter(legal_entity=entity)
        .select_for_update(of=("self",))
        .select_related("user", "department")
        .order_by("pk")
    }
    require_operator_entity(user, entity.pk)
    identities = {employee.external_id: employee for employee in employees.values()}
    departments = {
        department.code: department for department in Department.objects.filter(legal_entity=entity)
    }
    changed = []
    balance_changes = []
    for index, record in enumerate(snapshot.employees):
        employee = identities.get(record.external_id)
        if employee is None:
            _invalid_record(
                index,
                "external_id",
                "Provision each source employee in this legal entity before importing employment facts.",
            )
        department = departments.get(record.department_code)
        if department is None:
            _invalid_record(
                index, "department_code", "Choose a provisioned department from this legal entity."
            )
        manager = identities.get(record.manager_external_id) if record.manager_external_id else None
        if record.manager_external_id and manager is None:
            _invalid_record(
                index, "manager_external_id", "Choose a provisioned manager from this legal entity."
            )
        if record.balance_as_of < employee.balance_as_of:
            raise Conflict("The official balance date cannot move backwards.")
        try:
            balance_changes.extend(_balance_changes(employee, record))
        except (Conflict, ValidationError) as error:
            raise type(error)(
                {
                    "employees": {
                        str(index): {"balance_reconciliation": [_first_error(error.detail)]}
                    }
                }
            ) from error
        employee.full_name = record.full_name
        employee.position = record.position
        employee.department = department
        employee.manager_id = manager.pk if manager else None
        employee.hired_on = record.hired_on
        employee.leave_balance = record.leave_balance
        employee.balance_as_of = record.balance_as_of
        employee.locale = record.locale
        employee.is_active = record.is_active
        employee.source_revision = f"{snapshot.source}:{snapshot.source_revision}"
        employee.synced_at = timezone.now()
        employee.updated_at = employee.synced_at
        changed.append(employee)
    _manager_graph(employees)

    batch = SourceImportBatch.objects.create(
        legal_entity=entity,
        source=snapshot.source,
        source_revision=snapshot.source_revision,
        captured_at=snapshot.captured_at,
        payload_hash=digest,
        payload=canonical,
        employee_count=len(changed),
        status=SourceImportBatch.Status.ACCEPTED,
        actor=user,
    )
    Employee.objects.bulk_update(
        changed,
        [
            "full_name",
            "position",
            "department",
            "manager",
            "hired_on",
            "leave_balance",
            "balance_as_of",
            "locale",
            "is_active",
            "source_revision",
            "synced_at",
            "updated_at",
        ],
    )
    for employee in changed:
        EmployeeImportState.objects.update_or_create(
            employee=employee, defaults={"last_accepted_batch": batch}
        )
    for change in balance_changes:
        request = change.pop("request")
        LeaveBalanceIncorporation.objects.update_or_create(
            request=request,
            defaults={
                **change,
                "source": snapshot.source,
                "source_revision": snapshot.source_revision,
                "source_batch_id": batch.pk,
                "confirmed_at": snapshot.captured_at,
            },
        )
    state.last_revision = snapshot.source_revision
    state.last_captured_at = snapshot.captured_at
    state.last_accepted_batch = batch
    state.save(
        update_fields=["last_revision", "last_captured_at", "last_accepted_batch", "updated_at"]
    )
    emit(
        "integration.source_imported",
        "source_import_batch",
        batch.pk,
        {
            "legal_entity_id": str(entity.pk),
            "source_revision": snapshot.source_revision,
            "employee_count": len(changed),
            "payload_hash": digest,
        },
        actor=user,
    )
    return ImportOutcome(batch, 201)


@transaction.atomic
def import_snapshot(user, snapshot: ImportSnapshot):
    entity = require_operator_entity(user, snapshot.legal_entity_id, lock=True)
    state, _ = EntitySyncState.objects.get_or_create(legal_entity=entity)
    canonical = snapshot.canonical()
    digest = payload_hash(canonical)
    try:
        with transaction.atomic():
            return _apply_snapshot(user, entity, state, snapshot, canonical, digest)
    except (Conflict, ValidationError) as error:
        message = _first_error(error.detail)
        batch = SourceImportBatch.objects.create(
            legal_entity=entity,
            source=snapshot.source,
            source_revision=snapshot.source_revision,
            captured_at=snapshot.captured_at,
            payload_hash=digest,
            payload=canonical,
            employee_count=len(snapshot.employees),
            status=SourceImportBatch.Status.REJECTED,
            actor=user,
            error_code="source_snapshot_conflict"
            if isinstance(error, Conflict)
            else "source_data_invalid",
            error_message=message[:500],
            error_fields=error.detail if isinstance(error.detail, dict) else {},
        )
        emit(
            "integration.source_rejected",
            "source_import_batch",
            batch.pk,
            {
                "legal_entity_id": str(entity.pk),
                "source_revision": snapshot.source_revision,
                "error_code": batch.error_code,
            },
            actor=user,
        )
        return ImportOutcome(batch, error.status_code)
