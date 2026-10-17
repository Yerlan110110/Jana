from django.contrib.auth.models import Permission
from django.db import transaction
from django.utils import timezone

from apps.core.models import OutboxMessage
from apps.identity.models import User

from .contracts import EmployeeSnapshot, ImportSnapshot
from .imports import import_snapshot
from .models import DemoOperatorGrant, EntitySyncState, MockDeliveryFault
from .selectors import EXPORT_TOPIC


def _employee_snapshot(employee, *, department_code=None):
    return EmployeeSnapshot(
        external_id=employee.external_id,
        full_name=employee.full_name,
        position=employee.position,
        department_code=department_code or employee.department.code,
        manager_external_id=employee.manager.external_id if employee.manager_id else None,
        hired_on=employee.hired_on,
        leave_balance=employee.leave_balance,
        balance_as_of=employee.balance_as_of,
        locale=employee.locale,
        is_active=employee.is_active,
        incorporated_request_ids=(),
        balance_reversals=(),
    )


def _seed_source_history(state, employees):
    staff = [
        employee for employee in employees if employee.legal_entity_id == state.legal_entity_id
    ]
    operator = next(employee.user for employee in staff if employee.user.role == User.Role.HR)
    accepted = import_snapshot(
        operator,
        ImportSnapshot(
            legal_entity_id=state.legal_entity_id,
            source_revision=1,
            captured_at=timezone.now(),
            employees=tuple(_employee_snapshot(employee) for employee in staff),
        ),
    )
    if accepted.http_status != 201:
        raise ValueError("The synthetic source snapshot failed its integration contract.")
    import_snapshot(
        operator,
        ImportSnapshot(
            legal_entity_id=state.legal_entity_id,
            source_revision=2,
            captured_at=timezone.now(),
            employees=(_employee_snapshot(staff[0], department_code="SYN-UNMAPPED-DEPARTMENT"),),
        ),
    )


@transaction.atomic
def seed_integrations(employees):
    permission = Permission.objects.get(
        content_type__app_label="integrations", codename="operate_integrations"
    )
    created = []
    for employee in employees:
        state, was_created = EntitySyncState.objects.get_or_create(
            legal_entity=employee.legal_entity
        )
        if was_created:
            created.append(state)
        if employee.user.role == User.Role.HR and employee.external_id.startswith("SYN-"):
            _, first_provisioning = DemoOperatorGrant.objects.get_or_create(
                user=employee.user, defaults={"permission": permission}
            )
            if first_provisioning:
                employee.user.user_permissions.add(permission)
    for state in created:
        _seed_source_history(state, employees)
    messages = OutboxMessage.objects.filter(
        topic=EXPORT_TOPIC,
        event__requesthistory__request__employee__user__username="employee.demo",
    ).select_related("event__requesthistory__request")
    for message in messages:
        leave = message.event.requesthistory.request.kind == "leave"
        MockDeliveryFault.objects.get_or_create(
            outbox=message,
            defaults={
                "transient_failures_remaining": 1 if leave else 0,
                "permanent_failure": not leave,
            },
        )
    return created
