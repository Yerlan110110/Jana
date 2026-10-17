from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied

from apps.core.errors import Conflict
from apps.core.events import emit
from apps.core.models import OutboxMessage

from .models import MockDeliveryFault
from .selectors import export_actions, visible_exports


def _locked_export(user, message_id, expected_version):
    message = visible_exports(user).select_for_update(of=("self",)).filter(pk=message_id).first()
    if message is None:
        raise NotFound()
    if message.version != expected_version:
        raise Conflict("Refresh the export before repeating this operation.")
    return message


@transaction.atomic
def retry_export(user, message_id, expected_version):
    message = _locked_export(user, message_id, expected_version)
    if "retry" not in export_actions(message):
        raise Conflict("Only an export with a delivery failure can be retried.")
    message.status = OutboxMessage.Status.PENDING
    message.available_at = timezone.now()
    message.cycle_attempt_count = 0
    message.failure_code = ""
    message.last_error = ""
    message.version += 1
    message.save()
    emit(
        "integration.export_retry_requested",
        "outbox_message",
        message.pk,
        {"attempt_count": message.attempt_count, "version": message.version},
        actor=user,
    )
    return message


@transaction.atomic
def configure_mock_fault(
    user, message_id, expected_version, *, transient_failures, permanent_failure
):
    if not getattr(settings, "INTEGRATIONS_ALLOW_MOCK_FAULTS", settings.DEBUG):
        raise PermissionDenied("Mock fault controls are disabled in this environment.")
    message = _locked_export(user, message_id, expected_version)
    if message.status not in {OutboxMessage.Status.PENDING, OutboxMessage.Status.FAILED}:
        raise Conflict("A mock fault can change only before delivery or after a failed attempt.")
    MockDeliveryFault.objects.update_or_create(
        outbox=message,
        defaults={
            "transient_failures_remaining": transient_failures,
            "permanent_failure": permanent_failure,
        },
    )
    message.version += 1
    message.save(update_fields=["version", "updated_at"])
    emit(
        "integration.mock_fault_configured",
        "outbox_message",
        message.pk,
        {
            "transient_failures": transient_failures,
            "permanent_failure": permanent_failure,
            "version": message.version,
        },
        actor=user,
    )
    return message
