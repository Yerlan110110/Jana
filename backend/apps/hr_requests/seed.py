"""Populate every request state through the same commands used by the API."""

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.identity.models import User
from apps.identity.seed import synthetic_id
from apps.notifications.models import Notification
from apps.notifications.services import mark_read

from . import services
from .models import HRRequest

STATUSES = [
    "draft",
    "pending_manager",
    "pending_hr",
    "approved",
    "rejected",
    "returned",
    "cancelled",
]
REASONS = {
    "draft": "Демо: планирую даты и проверяю доступные условия.",
    "pending_manager": "Демо: заявление отправлено руководителю для проверки периода и передачи задач.",
    "pending_hr": "Демо: руководитель проверил передачу задач, ожидаю кадровую проверку.",
    "approved": "Демо: согласование завершено, подтверждение внешней обработки учитывается отдельно.",
    "rejected": "Демо: сохранён пример отказа с объяснением и полной историей.",
    "returned": "Демо: уточняю исправимое замечание и подготовлю следующую версию.",
    "cancelled": "Демо: планы изменились, сохранил отмену и историю отправки.",
}


@transaction.atomic
def seed_requests(employees):
    today = timezone.localdate()
    employees = list(employees)
    created = []
    for owner_index, owner in enumerate(employees):
        if owner.user.username == "new.demo" or not owner.is_active or not owner.user.is_active:
            continue
        primary = owner.user.username == "employee.demo"
        cases = (
            [(kind, state_index) for kind in HRRequest.Kind.values for state_index in range(7)]
            if primary
            else [("leave", owner_index % 7), ("advance", (owner_index + 3) % 7)]
        )
        for kind, state_index in cases:
            request_id = synthetic_id(f"request/{owner.external_id}/{kind}/{state_index}")
            if HRRequest.objects.filter(pk=request_id).exists():
                continue
            target = STATUSES[state_index]
            start = today + timedelta(days=7 + state_index * 12)
            values = {"kind": kind, "reason": REASONS[target]}
            if kind == HRRequest.Kind.LEAVE:
                values.update(start_date=start, end_date=start + timedelta(days=state_index % 3))
            else:
                values.update(
                    amount=Decimal(30000 + (owner_index % 7) * 15000),
                    currency="KZT",
                    requested_payment_date=start,
                )
            item = services.create(owner.user, values, request_id=request_id)
            if target != "draft":
                item = services.submit(owner.user, item.pk, item.version)
                hr = next(
                    (
                        person
                        for person in employees
                        if person.user.role == User.Role.HR
                        and person.legal_entity_id == owner.legal_entity_id
                        and person.pk != owner.pk
                        and person.is_active
                        and person.user.is_active
                    ),
                    None,
                )
                if hr is None:
                    raise ValueError(
                        f"No independent HR reviewer for synthetic request {request_id}."
                    )
                initial_reviewer = item.assigned_manager.user if item.assigned_manager else hr.user
                if (
                    target in {"pending_hr", "approved"}
                    and item.status == HRRequest.Status.PENDING_MANAGER
                ):
                    item = services.decide(
                        initial_reviewer,
                        item.pk,
                        item.version,
                        "approve",
                        "Демо: передача задач проверена.",
                    )
                if target == "approved":
                    item = services.decide(
                        hr.user,
                        item.pk,
                        item.version,
                        "approve",
                        "Демо: кадровая проверка завершена; это не подтверждение выплаты.",
                    )
                elif target == "rejected":
                    item = services.decide(
                        initial_reviewer,
                        item.pk,
                        item.version,
                        "reject",
                        "Демо: выбранный вариант не согласован. Подайте отдельную заявку после обсуждения альтернативы.",
                    )
                elif target == "returned":
                    item = services.decide(
                        initial_reviewer,
                        item.pk,
                        item.version,
                        "return_for_changes",
                        "Демо: укажите основание и уточните желаемый период или дату выплаты.",
                    )
                elif target == "cancelled":
                    item = services.cancel(owner.user, item.pk, item.version)
            if state_index % 2 == 0:
                notification = (
                    Notification.objects.filter(recipient=owner.user, target_id=item.pk)
                    .order_by("created_at", "id")
                    .first()
                )
                if notification:
                    mark_read(owner.user, notification.pk)
            created.append(item)
    return created
