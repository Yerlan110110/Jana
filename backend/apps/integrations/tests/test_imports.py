from copy import deepcopy
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.contrib.auth.models import Permission
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone

from apps.core.models import DomainEvent
from apps.hr_requests.models import HRRequest, LeaveBalanceIncorporation
from apps.hr_requests.selectors import leave_projection
from apps.identity.models import Employee, User
from apps.integrations.imports import import_snapshot
from apps.integrations.models import EntitySyncState, SourceImportBatch
from apps.integrations.worker import process_once

from .helpers import approved_request, employee_record, post_import, snapshot, source_batch

pytestmark = pytest.mark.django_db(transaction=True)


def test_import_updates_official_facts_without_provisioning_or_changing_role(employees, operator):
    employee = employees["employee"]
    payload = source_batch(
        employee,
        records=[
            employee_record(
                employee, full_name="Synthetic Updated", leave_balance="31.25", locale="kk"
            )
        ],
    )
    response = post_import(operator, payload)
    assert response.status_code == 201, response.data
    employee.refresh_from_db()
    assert employee.full_name == "Synthetic Updated"
    assert employee.leave_balance == Decimal("31.25")
    assert employee.locale == "kk" and employee.user.role == "employee"
    assert employee.source_revision == "mock_1c:1" and employee.synced_at is not None
    assert Employee.objects.count() == 7
    assert response.data["batch"]["import_status"] == "accepted"
    assert (
        str(employee.integration_import_state.last_accepted_batch_id)
        == response.data["batch"]["id"]
    )


def test_import_requires_operator_permission_and_hr_role(employees, operator):
    payload = source_batch(employees["employee"])
    permission = Permission.objects.get(
        content_type__app_label="integrations", codename="operate_integrations"
    )
    for key in ["employee", "manager"]:
        user = employees[key].user
        user.user_permissions.add(permission)
        assert post_import(user, payload).status_code == 403
    operator.user_permissions.remove(permission)
    assert post_import(User.objects.get(pk=operator.pk), payload).status_code == 403
    assert not SourceImportBatch.objects.exists()


def test_import_hides_other_entity_and_rejects_cross_entity_employee(employees, operator):
    other = employees["other_entity"]
    assert post_import(operator, source_batch(other)).status_code == 404
    local = employees["employee"]
    response = post_import(operator, source_batch(local, records=[employee_record(other)]))
    assert response.status_code == 400
    other.refresh_from_db()
    assert other.source_revision == ""


def test_import_rejects_mass_assigned_roles_and_unknown_fields(employees, operator):
    employee = employees["employee"]
    for extra in [
        {"role": "hr"},
        {"user_id": str(operator.pk)},
        {"legal_entity_id": str(employees["other_entity"].legal_entity_id)},
    ]:
        response = post_import(
            operator, source_batch(employee, records=[employee_record(employee, **extra)])
        )
        assert response.status_code == 400
    assert not SourceImportBatch.objects.exists()


def test_source_revision_remains_exact_in_javascript_clients(employees, operator):
    response = post_import(operator, source_batch(employees["employee"], revision=2**53))
    assert response.status_code == 400
    assert "source_revision" in response.data["field_errors"]
    assert not SourceImportBatch.objects.exists()


def test_duplicate_transport_key_and_identical_source_revision_converge(employees, operator):
    employee = employees["employee"]
    payload = source_batch(employee)
    first = post_import(operator, payload, key="same-import")
    replay = post_import(operator, payload, key="same-import")
    source_replay = post_import(operator, payload)
    assert first.status_code == replay.status_code == 201
    assert first.data == replay.data
    assert replay.headers["Idempotency-Replayed"] == "true"
    assert source_replay.status_code == 200 and source_replay.data["source_replayed"] is True
    assert SourceImportBatch.objects.count() == 1
    assert DomainEvent.objects.filter(event_type="integration.source_imported").count() == 1


def test_record_order_does_not_change_source_identity(employees, operator):
    records = [employee_record(employees[key]) for key in ["employee", "peer"]]
    payload = source_batch(employees["employee"], records=records)
    first = post_import(operator, payload)
    payload["employees"] = list(reversed(records))
    second = post_import(operator, payload)
    assert first.status_code == 201 and second.status_code == 200
    assert first.data["batch"]["id"] == second.data["batch"]["id"]


def test_stale_or_conflicting_revision_preserves_facts_and_records_rejection(employees, operator):
    employee = employees["employee"]
    accepted = source_batch(
        employee, revision=3, records=[employee_record(employee, leave_balance="19.50")]
    )
    assert post_import(operator, accepted).status_code == 201
    stale = source_batch(
        employee, revision=2, records=[employee_record(employee, leave_balance="100.00")]
    )
    assert post_import(operator, stale).status_code == 409
    conflicting = deepcopy(accepted)
    conflicting["employees"][0]["leave_balance"] = "101.00"
    rejected = post_import(operator, conflicting)
    assert rejected.status_code == 409 and rejected.data["integration_audit_id"]
    employee.refresh_from_db()
    assert employee.leave_balance == Decimal("19.50")
    assert EntitySyncState.objects.get(legal_entity=employee.legal_entity).last_revision == 3
    assert SourceImportBatch.objects.filter(status="rejected").count() == 2


def test_replay_of_old_accepted_snapshot_does_not_regress_a_newer_import(employees, operator):
    employee = employees["employee"]
    old = source_batch(employee, records=[employee_record(employee, position="Old")])
    assert post_import(operator, old).status_code == 201
    assert (
        post_import(
            operator,
            source_batch(employee, revision=2, records=[employee_record(employee, position="New")]),
        ).status_code
        == 201
    )
    assert post_import(operator, old).status_code == 200
    employee.refresh_from_db()
    assert employee.position == "New" and employee.source_revision == "mock_1c:2"


def test_capture_and_balance_dates_cannot_regress(employees, operator):
    employee = employees["employee"]
    captured = timezone.now() - timedelta(seconds=10)
    assert (
        post_import(operator, source_batch(employee, captured_at=captured.isoformat())).status_code
        == 201
    )
    backwards_capture = source_batch(
        employee, revision=2, captured_at=(captured - timedelta(days=1)).isoformat()
    )
    backwards_capture["employees"][0]["balance_as_of"] = (
        employee.balance_as_of - timedelta(days=1)
    ).isoformat()
    assert post_import(operator, backwards_capture).status_code == 409
    backwards_balance = source_batch(
        employee,
        revision=2,
        records=[
            employee_record(
                employee, balance_as_of=(employee.balance_as_of - timedelta(days=1)).isoformat()
            )
        ],
    )
    assert post_import(operator, backwards_balance).status_code == 409


def test_invalid_later_record_rolls_back_the_complete_batch(employees, operator):
    employee, peer = employees["employee"], employees["peer"]
    original = employee.position
    payload = source_batch(
        employee,
        records=[
            employee_record(employee, position="Must roll back"),
            employee_record(peer, department_code="UNKNOWN"),
        ],
    )
    response = post_import(operator, payload)
    assert response.status_code == 400
    assert response.data["field_errors"]["employees"]["1"]["department_code"]
    employee.refresh_from_db()
    assert employee.position == original and employee.source_revision == ""
    assert not SourceImportBatch.objects.filter(status="accepted").exists()
    assert SourceImportBatch.objects.filter(status="rejected").count() == 1


def test_database_failure_rolls_back_facts_state_and_acceptance_audit(employees, operator):
    employee = employees["employee"]
    data = snapshot(
        source_batch(employee, records=[employee_record(employee, position="Must roll back")])
    )
    with (
        patch("apps.integrations.imports.emit", side_effect=RuntimeError("synthetic failure")),
        pytest.raises(RuntimeError),
    ):
        import_snapshot(operator, data)
    employee.refresh_from_db()
    assert employee.position != "Must roll back"
    assert not SourceImportBatch.objects.exists()
    assert not EntitySyncState.objects.exists()


def test_manager_batch_validates_intended_graph_instead_of_update_order(employees, operator):
    first, second = employees["manager"], employees["other_manager"]
    second.manager = first
    second.save()
    payload = source_batch(
        first,
        records=[
            employee_record(first, manager_external_id=second.external_id),
            employee_record(second, manager_external_id=None),
        ],
    )
    assert post_import(operator, payload).status_code == 201
    first.refresh_from_db()
    second.refresh_from_db()
    assert first.manager_id == second.pk and second.manager_id is None


def test_manager_cycle_and_inactive_manager_reject_entire_snapshot(employees, operator):
    first, second = employees["manager"], employees["other_manager"]
    cycle = source_batch(
        first,
        records=[
            employee_record(first, manager_external_id=second.external_id),
            employee_record(second, manager_external_id=first.external_id),
        ],
    )
    assert post_import(operator, cycle).status_code == 400
    assert (
        post_import(
            operator, source_batch(first, records=[employee_record(first, is_active=False)])
        ).status_code
        == 400
    )
    first.refresh_from_db()
    assert first.manager_id is None and first.is_active is True


def test_confirmed_approved_leave_is_not_subtracted_twice(employees, operator):
    employee = employees["employee"]
    request, _ = approved_request(employees)
    assert leave_projection(employee)["projected_balance"] == Decimal("21")
    assert process_once() is True
    employee.refresh_from_db()
    assert leave_projection(employee)["portal_reserved_days"] == Decimal("3")
    payload = source_batch(
        employee,
        records=[
            employee_record(
                employee, leave_balance="21.00", incorporated_request_ids=[str(request.pk)]
            )
        ],
    )
    assert post_import(operator, payload).status_code == 201
    employee.refresh_from_db()
    balance = leave_projection(employee)
    assert balance["official_balance"] == balance["projected_balance"] == Decimal("21")
    assert balance["source_incorporated_days"] == Decimal("3")
    assert balance["portal_reserved_days"] == Decimal("0")
    ledger = LeaveBalanceIncorporation.objects.get(request=request)
    assert ledger.request_revision_id == request.revisions.get(number=1).pk
    assert ledger.leave_days == Decimal("3")


def test_new_snapshot_must_reaffirm_incorporation_or_explicitly_reverse_it(employees, operator):
    employee = employees["employee"]
    request, _ = approved_request(employees)
    incorporated = source_batch(
        employee,
        records=[
            employee_record(
                employee, leave_balance="21.00", incorporated_request_ids=[str(request.pk)]
            )
        ],
    )
    first = post_import(operator, incorporated)
    assert first.status_code == 201
    missing = source_batch(
        employee, revision=2, records=[employee_record(employee, leave_balance="24.00")]
    )
    assert post_import(operator, missing).status_code == 409
    employee.refresh_from_db()
    assert employee.leave_balance == Decimal("21")
    reversal = source_batch(
        employee,
        revision=2,
        records=[
            employee_record(
                employee,
                leave_balance="24.00",
                balance_reversals=[
                    {
                        "request_id": str(request.pk),
                        "reason": "Synthetic source corrected an earlier incorporation.",
                    }
                ],
            )
        ],
    )
    assert post_import(operator, reversal).status_code == 201
    employee.refresh_from_db()
    request.refresh_from_db()
    assert request.status == HRRequest.Status.APPROVED
    assert leave_projection(employee)["projected_balance"] == Decimal("21")
    assert LeaveBalanceIncorporation.objects.get(request=request).state == "reversed"
    first_audit = SourceImportBatch.objects.get(pk=first.data["batch"]["id"])
    assert first_audit.payload["employees"][0]["incorporated_request_ids"] == [str(request.pk)]
    reconfirm = source_batch(
        employee,
        revision=3,
        records=[
            employee_record(
                employee, leave_balance="21.00", incorporated_request_ids=[str(request.pk)]
            )
        ],
    )
    assert post_import(operator, reconfirm).status_code == 201
    assert LeaveBalanceIncorporation.objects.get(request=request).state == "incorporated"


@pytest.mark.parametrize("case", ["another_employee", "advance", "pending", "unknown"])
def test_balance_confirmation_requires_own_final_leave(employees, operator, case):
    import uuid

    employee = employees["employee"]
    if case == "unknown":
        request_id = uuid.uuid4()
    else:
        request, _ = approved_request(
            employees,
            kind="advance" if case == "advance" else "leave",
            employee_key="peer" if case == "another_employee" else "employee",
        )
        if case == "pending":
            HRRequest.objects.filter(pk=request.pk).update(status="pending_hr")
        request_id = request.pk
    payload = source_batch(
        employee, records=[employee_record(employee, incorporated_request_ids=[str(request_id)])]
    )
    assert post_import(operator, payload).status_code == 400
    assert not LeaveBalanceIncorporation.objects.exists()


def test_import_replay_is_reauthorized_after_permission_is_revoked(employees, operator):
    payload = source_batch(employees["employee"])
    assert post_import(operator, payload, key="scoped-import").status_code == 201
    operator.user_permissions.clear()
    assert (
        post_import(User.objects.get(pk=operator.pk), payload, key="scoped-import").status_code
        == 403
    )


def test_import_audit_is_immutable(employees, operator):
    result = post_import(operator, source_batch(employees["employee"]))
    audit = SourceImportBatch.objects.get(pk=result.data["batch"]["id"])
    with pytest.raises(DjangoValidationError):
        audit.delete()
    with pytest.raises(DjangoValidationError):
        SourceImportBatch.objects.filter(pk=audit.pk).update(payload={})


def test_source_lists_and_detail_are_scoped_without_foreign_filter_choices(
    employees, operator, api_client
):
    response = post_import(operator, source_batch(employees["employee"]))
    audit_id = response.data["batch"]["id"]
    api_client.force_authenticate(operator)
    assert api_client.get("/api/v1/integrations/imports/").data["count"] == 1
    hidden = api_client.get(
        f"/api/v1/integrations/imports/?legal_entity={employees['other_entity'].legal_entity_id}"
    )
    assert hidden.status_code == 200 and hidden.data["count"] == 0
    operator.employee.legal_entity = employees["other_entity"].legal_entity
    operator.employee.department = employees["other_entity"].department
    operator.employee.save()
    assert api_client.get(f"/api/v1/integrations/imports/{audit_id}/").status_code == 404
