from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from django.core.exceptions import ValidationError as ModelValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.core.models import DomainEvent, IdempotencyRecord, OutboxMessage
from apps.hr_requests import services
from apps.hr_requests.models import HRRequest, RequestHistory, RequestRevision
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db


def leave_details(offset=10, days=3):
    start = timezone.localdate() + timedelta(days=offset)
    return {
        "kind": "leave",
        "start_date": start,
        "end_date": start + timedelta(days=days - 1),
        "reason": "Синтетический семейный отпуск",
    }


def advance_details():
    return {
        "kind": "advance",
        "amount": "75000.00",
        "currency": "KZT",
        "requested_payment_date": timezone.localdate() + timedelta(days=8),
        "reason": "Синтетическая заявка на аванс",
    }


def create_via_api(client, employee, values=None, key=None):
    client.force_authenticate(employee.user)
    return client.post(
        "/api/v1/requests/",
        values or leave_details(),
        format="json",
        HTTP_IDEMPOTENCY_KEY=key or str(uuid4()),
    )


def transition(client, actor, item, action, *, key=None, version=None, **extra):
    client.force_authenticate(actor.user)
    return client.post(
        f"/api/v1/requests/{item['id']}/{action}/",
        {"expected_version": version if version is not None else item["version"], **extra},
        format="json",
        HTTP_IDEMPOTENCY_KEY=key or str(uuid4()),
    )


def test_complete_leave_route_preserves_official_balance_and_creates_evidence(
    api_client, employees
):
    item = create_via_api(api_client, employees["employee"])
    assert item.status_code == 201
    assert item.data["leave_days"] == "3.00"
    assert item.data["allowed_actions"] == ["update_draft", "submit", "cancel"]
    submitted = transition(api_client, employees["employee"], item.data, "submit")
    assert submitted.status_code == 200
    assert submitted.data["status"] == "pending_manager"
    assert submitted.data["revisions"][0]["assigned_manager"] == str(employees["manager"].pk)
    assert submitted.data["revisions"][0]["payload"]["policy"] == "synthetic_manager_then_hr_v1"
    managed = transition(api_client, employees["manager"], submitted.data, "approve")
    assert managed.status_code == 200
    assert managed.data["status"] == "pending_hr"
    approved = transition(api_client, employees["hr"], managed.data, "approve")
    assert approved.status_code == 200
    assert approved.data["status"] == "approved"
    assert approved.data["version"] == 4
    assert [step["action"] for step in approved.data["history"]] == [
        "created",
        "submitted",
        "approved",
        "approved",
    ]
    assert approved.data["allowed_actions"] == []
    assert DomainEvent.objects.filter(aggregate_id=item.data["id"]).count() == 4
    export = OutboxMessage.objects.get()
    assert export.topic == "documentolog.export_request"
    assert export.status == "pending"
    assert Notification.objects.filter(recipient=employees["employee"].user).count() == 3
    api_client.force_authenticate(employees["employee"].user)
    balance = api_client.get("/api/v1/requests/leave-balance/").data
    assert balance["official_balance"] == "24.00"
    assert balance["portal_reserved_days"] == "3.00"
    assert balance["projected_balance"] == "21.00"
    assert balance["day_count_convention"] == "calendar_days_inclusive_demo"
    employees["employee"].refresh_from_db()
    assert employees["employee"].leave_balance == Decimal("24.00")


def test_salary_advance_has_explicit_fields_and_approval_is_separate_from_export(
    api_client, employees
):
    created = create_via_api(api_client, employees["employee"], advance_details())
    assert created.status_code == 201
    assert created.data["amount"] == "75000.00"
    assert created.data["start_date"] is None
    submitted = transition(api_client, employees["employee"], created.data, "submit")
    managed = transition(api_client, employees["manager"], submitted.data, "approve")
    approved = transition(api_client, employees["hr"], managed.data, "approve")
    assert approved.status_code == 200
    assert approved.data["status"] == "approved"
    assert OutboxMessage.objects.get().processed_at is None
    assert "paid" not in approved.data


@pytest.mark.parametrize("outsider", ["peer", "other_team", "other_entity", "other_manager"])
def test_list_detail_and_command_apply_same_scope(api_client, employees, outsider):
    created = create_via_api(api_client, employees["employee"]).data
    api_client.force_authenticate(employees[outsider].user)
    assert api_client.get("/api/v1/requests/").data["count"] == 0
    assert api_client.get(f"/api/v1/requests/{created['id']}/").status_code == 404
    assert transition(api_client, employees[outsider], created, "approve").status_code == 404


def test_hr_scope_and_direct_manager_scope_are_different(api_client, employees):
    first = create_via_api(api_client, employees["employee"]).data
    second = create_via_api(api_client, employees["other_team"]).data
    foreign = create_via_api(api_client, employees["other_entity"]).data
    api_client.force_authenticate(employees["manager"].user)
    assert {row["id"] for row in api_client.get("/api/v1/requests/").data["results"]} == {
        first["id"]
    }
    api_client.force_authenticate(employees["hr"].user)
    assert {row["id"] for row in api_client.get("/api/v1/requests/").data["results"]} == {
        first["id"],
        second["id"],
    }
    assert api_client.get(f"/api/v1/requests/{foreign['id']}/").status_code == 404


def test_own_hr_request_cannot_be_reviewed_even_by_technical_superuser(api_client, employees):
    actor = employees["hr"]
    created = create_via_api(api_client, actor).data
    submitted = transition(api_client, actor, created, "submit")
    assert submitted.data["status"] == "pending_hr"
    assert transition(api_client, actor, submitted.data, "approve").status_code == 403
    actor.user.is_superuser = True
    actor.user.save()
    assert transition(api_client, actor, submitted.data, "approve").status_code == 403


def test_review_order_and_draft_ownership_cannot_be_bypassed(api_client, employees):
    created = create_via_api(api_client, employees["employee"]).data
    assert transition(api_client, employees["manager"], created, "approve").status_code == 403
    assert transition(api_client, employees["hr"], created, "submit").status_code == 403
    submitted = transition(api_client, employees["employee"], created, "submit").data
    assert transition(api_client, employees["hr"], submitted, "approve").status_code == 403
    assert transition(api_client, employees["employee"], submitted, "approve").status_code == 403


def test_versions_and_mass_assignment_are_enforced(api_client, employees):
    created = create_via_api(api_client, employees["employee"]).data
    api_client.force_authenticate(employees["employee"].user)
    url = f"/api/v1/requests/{created['id']}/"
    for field, value in [
        ("status", "approved"),
        ("employee", str(employees["hr"].pk)),
        ("leave_days", "0"),
        ("kind", "advance"),
    ]:
        response = api_client.patch(
            url,
            {"expected_version": 1, field: value},
            format="json",
            HTTP_IDEMPOTENCY_KEY=str(uuid4()),
        )
        assert response.status_code == 400
        assert field in response.data["field_errors"]
    missing_version = api_client.patch(
        url, {"reason": "Changed"}, HTTP_IDEMPOTENCY_KEY=str(uuid4())
    )
    assert missing_version.status_code == 400
    changed = api_client.patch(
        url,
        {"expected_version": 1, "reason": "Изменённая причина"},
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert changed.status_code == 200
    assert changed.data["version"] == 2
    stale = transition(api_client, employees["employee"], created, "submit")
    assert stale.status_code == 409
    assert stale.data["code"] == "conflict"
    assert stale.data["request_id"]


def test_idempotency_replays_original_snapshot_and_rejects_reuse(api_client, employees):
    created = create_via_api(api_client, employees["employee"], key="create-once")
    replay = create_via_api(api_client, employees["employee"], key="create-once")
    assert replay.status_code == 201
    assert replay.data == created.data
    assert replay["Idempotency-Replayed"] == "true"
    assert HRRequest.objects.count() == 1
    changed = create_via_api(
        api_client, employees["employee"], {**leave_details(), "reason": "Other"}, key="create-once"
    )
    assert changed.status_code == 409
    assert (
        transition(
            api_client, employees["employee"], created.data, "submit", key="create-once"
        ).status_code
        == 409
    )
    submitted = transition(
        api_client, employees["employee"], created.data, "submit", key="submit-once"
    )
    managed = transition(api_client, employees["manager"], submitted.data, "approve")
    assert managed.status_code == 200
    repeated = transition(
        api_client, employees["employee"], created.data, "submit", key="submit-once"
    )
    assert repeated.data == submitted.data
    assert repeated["Idempotency-Replayed"] == "true"
    assert RequestRevision.objects.count() == 1


@pytest.mark.parametrize("key", ["", "contains space", "x" * 129, "кириллица", "null\x00byte"])
def test_invalid_idempotency_keys_are_rejected(api_client, employees, key):
    api_client.force_authenticate(employees["employee"].user)
    result = api_client.post(
        "/api/v1/requests/", leave_details(), format="json", HTTP_IDEMPOTENCY_KEY=key
    )
    assert result.status_code == 400
    assert not HRRequest.objects.exists()


def test_return_edit_resubmit_keeps_first_submitted_revision(api_client, employees):
    created = create_via_api(api_client, employees["employee"]).data
    submitted = transition(api_client, employees["employee"], created, "submit").data
    assert (
        transition(api_client, employees["manager"], submitted, "return-for-changes").status_code
        == 400
    )
    returned = transition(
        api_client,
        employees["manager"],
        submitted,
        "return-for-changes",
        comment="Уточните причину",
    ).data
    assert returned["status"] == "returned"
    api_client.force_authenticate(employees["employee"].user)
    edited = api_client.patch(
        f"/api/v1/requests/{created['id']}/",
        {"expected_version": returned["version"], "reason": "Уточнённая причина"},
        HTTP_IDEMPOTENCY_KEY=str(uuid4()),
    )
    assert edited.status_code == 200
    second = transition(api_client, employees["employee"], edited.data, "submit")
    assert second.status_code == 200
    assert [revision["number"] for revision in second.data["revisions"]] == [1, 2]
    assert second.data["revisions"][0]["payload"]["reason"] == created["reason"]
    assert second.data["revisions"][1]["payload"]["reason"] == "Уточнённая причина"
    revision = RequestRevision.objects.first()
    revision.payload = {"tampered": True}
    with pytest.raises(ModelValidationError):
        revision.save()
    with pytest.raises(ModelValidationError):
        RequestRevision.objects.filter(pk=revision.pk).update(payload={})
    with pytest.raises(ModelValidationError):
        RequestHistory.objects.filter(request_id=created["id"]).delete()


def test_organization_change_does_not_transfer_approval(api_client, employees):
    created = create_via_api(api_client, employees["employee"]).data
    submitted = transition(api_client, employees["employee"], created, "submit").data
    original = employees["manager"]
    owner = employees["employee"]
    owner.manager = employees["other_manager"]
    owner.save()
    assert transition(api_client, original, submitted, "approve").status_code == 404
    assert (
        transition(api_client, employees["other_manager"], submitted, "approve").status_code == 403
    )
    item = HRRequest.objects.get(pk=created["id"])
    assert item.assigned_manager_id == original.pk
    assert item.status == "pending_manager"
    assert transition(api_client, owner, submitted, "cancel").status_code == 200


def test_idempotent_response_does_not_bypass_revoked_scope(api_client, employees):
    created = create_via_api(api_client, employees["employee"]).data
    submitted = transition(api_client, employees["employee"], created, "submit").data
    managed = transition(
        api_client, employees["manager"], submitted, "approve", key="review-before-transfer"
    )
    assert managed.status_code == 200
    owner = employees["employee"]
    owner.manager = employees["other_manager"]
    owner.save()
    replay = transition(
        api_client, employees["manager"], submitted, "approve", key="review-before-transfer"
    )
    assert replay.status_code == 404


def test_submission_rolls_back_every_effect_when_notification_fails(
    api_client, employees, monkeypatch
):
    created = create_via_api(api_client, employees["employee"]).data

    def fail_notification(*args, **kwargs):
        raise RuntimeError("Injected notification persistence failure")

    monkeypatch.setattr(services, "notify", fail_notification)
    with pytest.raises(RuntimeError, match="Injected"):
        transition(api_client, employees["employee"], created, "submit", key="rollback-submit")
    item = HRRequest.objects.get(pk=created["id"])
    assert item.status == "draft" and item.version == 1
    assert not RequestRevision.objects.exists()
    assert RequestHistory.objects.count() == DomainEvent.objects.count() == 1
    assert not Notification.objects.exists()
    assert not IdempotencyRecord.objects.filter(key="rollback-submit").exists()


def test_final_approval_rolls_back_when_export_outbox_fails(api_client, employees, monkeypatch):
    created = create_via_api(api_client, employees["employee"]).data
    submitted = transition(api_client, employees["employee"], created, "submit").data
    managed = transition(api_client, employees["manager"], submitted, "approve").data
    before = Notification.objects.count()

    def fail_outbox(*args, **kwargs):
        raise RuntimeError("Injected outbox persistence failure")

    monkeypatch.setattr(OutboxMessage.objects, "create", fail_outbox)
    with pytest.raises(RuntimeError, match="Injected"):
        transition(api_client, employees["hr"], managed, "approve", key="rollback-approval")
    item = HRRequest.objects.get(pk=created["id"])
    assert item.status == "pending_hr" and item.version == managed["version"]
    assert Notification.objects.count() == before
    assert RequestHistory.objects.count() == DomainEvent.objects.count() == 3
    assert not IdempotencyRecord.objects.filter(key="rollback-approval").exists()


def test_overlap_balance_and_released_reservation(api_client, employees):
    first = create_via_api(api_client, employees["employee"], leave_details(days=20)).data
    submitted = transition(api_client, employees["employee"], first, "submit").data
    overlapping = create_via_api(api_client, employees["employee"], leave_details(offset=12)).data
    assert transition(api_client, employees["employee"], overlapping, "submit").status_code == 409
    too_long = create_via_api(
        api_client, employees["employee"], leave_details(offset=40, days=5)
    ).data
    assert transition(api_client, employees["employee"], too_long, "submit").status_code == 400
    assert transition(api_client, employees["employee"], submitted, "cancel").status_code == 200
    assert transition(api_client, employees["employee"], overlapping, "submit").status_code == 200


def test_approval_rechecks_changed_official_balance(api_client, employees):
    created = create_via_api(api_client, employees["employee"], leave_details(days=10)).data
    submitted = transition(api_client, employees["employee"], created, "submit").data
    owner = employees["employee"]
    owner.leave_balance = Decimal("5.00")
    owner.save()
    assert transition(api_client, employees["manager"], submitted, "approve").status_code == 400
    assert HRRequest.objects.get(pk=created["id"]).status == "pending_manager"


@pytest.mark.parametrize(
    "invalid", [{"amount": "25.00"}, {"currency": "KZT"}, {"end_date": "2020-01-01"}]
)
def test_invalid_request_field_combinations_fail_at_api(api_client, employees, invalid):
    assert (
        create_via_api(
            api_client, employees["employee"], {**leave_details(), **invalid}
        ).status_code
        == 400
    )


@pytest.mark.parametrize(
    "kind,fields", [("leave", {"leave_days": None}), ("advance", {"amount": None}), ("unknown", {})]
)
def test_database_also_rejects_invalid_request_shapes(employees, kind, fields):
    values = leave_details() if kind != "advance" else advance_details()
    values["kind"] = kind
    if kind == "leave":
        values["leave_days"] = Decimal("3.00")
    values.update(fields)
    with pytest.raises(IntegrityError), transaction.atomic():
        HRRequest.objects.create(employee=employees["employee"], **values)


def test_rejected_request_is_terminal_and_approved_request_cannot_be_cancelled(
    api_client, employees
):
    created = create_via_api(api_client, employees["employee"]).data
    submitted = transition(api_client, employees["employee"], created, "submit").data
    rejected = transition(
        api_client, employees["manager"], submitted, "reject", comment="Причина отказа"
    ).data
    assert transition(api_client, employees["employee"], rejected, "submit").status_code == 403
    assert transition(api_client, employees["employee"], rejected, "cancel").status_code == 403
    another = create_via_api(api_client, employees["employee"], advance_details()).data
    submitted = transition(api_client, employees["employee"], another, "submit").data
    managed = transition(api_client, employees["manager"], submitted, "approve").data
    approved = transition(api_client, employees["hr"], managed, "approve").data
    assert transition(api_client, employees["employee"], approved, "cancel").status_code == 403
