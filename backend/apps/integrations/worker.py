import logging
import uuid
from datetime import timedelta

from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone

from apps.core.events import emit
from apps.core.models import OutboxMessage
from apps.hr_requests.models import RequestHistory
from apps.identity.models import User
from apps.notifications.services import notify

from .adapters import MockDocumentologAdapter, build_export
from .contracts import DeliveryFailure, OutboxClaim
from .models import DeliveryAttempt, DeliveryAttemptResult, DocumentExportReceipt

logger = logging.getLogger(__name__)
MAX_CYCLE_ATTEMPTS = 5
LEASE_SECONDS = 60


def _notify_terminal_failure(message):
    history = (
        RequestHistory.objects.select_related("request__employee")
        .filter(event_id=message.event_id)
        .first()
    )
    event = emit(
        "integration.export_failed",
        "outbox_message",
        message.pk,
        {"failure_code": message.failure_code, "attempt_count": message.attempt_count},
    )
    if history is None:
        return
    operators = User.objects.filter(
        role=User.Role.HR,
        is_active=True,
        employee__is_active=True,
        employee__legal_entity_id=history.request.employee.legal_entity_id,
    )
    for user in operators:
        if user.has_perm("integrations.operate_integrations"):
            notify(
                user,
                "integration_failure",
                "Заявка согласована, экспорт требует проверки",
                "Откройте ошибку экспорта и повторите отправку после её устранения.",
                "outbox_message",
                message.pk,
                event,
            )


def _clear_claim(message):
    message.claim_token = None
    message.lease_expires_at = None


def _fail_exhausted_claim(message):
    message.status = OutboxMessage.Status.FAILED
    message.failure_code = "worker_claims_exhausted"
    message.last_error = (
        "The worker repeatedly lost its claim. Check the worker and retry this export."
    )
    message.version += 1
    _clear_claim(message)
    message.save()
    _notify_terminal_failure(message)


@transaction.atomic
def claim_next(*, now=None, lease_seconds=LEASE_SECONDS):
    if not 1 <= lease_seconds <= 3600:
        raise ValueError("The worker lease must be between 1 and 3600 seconds.")
    now = now or timezone.now()
    due = Q(status=OutboxMessage.Status.PENDING, available_at__lte=now) | Q(
        status=OutboxMessage.Status.PROCESSING, lease_expires_at__lte=now
    )
    while True:
        queryset = OutboxMessage.objects.filter(due).order_by("available_at", "id")
        lock_options = (
            {"skip_locked": True} if connection.features.has_select_for_update_skip_locked else {}
        )
        message = queryset.select_for_update(**lock_options).first()
        if message is None:
            return None
        if message.status == OutboxMessage.Status.PROCESSING:
            previous = DeliveryAttempt.objects.filter(claim_token=message.claim_token).first()
            if previous is not None:
                DeliveryAttemptResult.objects.get_or_create(
                    attempt=previous,
                    defaults={
                        "outcome": DeliveryAttemptResult.Outcome.LEASE_EXPIRED,
                        "failure_code": "worker_lease_expired",
                        "error_message": "The worker claim expired before local acknowledgment.",
                    },
                )
        if message.cycle_attempt_count >= MAX_CYCLE_ATTEMPTS:
            _fail_exhausted_claim(message)
            continue
        message.status = OutboxMessage.Status.PROCESSING
        message.claim_token = uuid.uuid4()
        message.lease_expires_at = now + timedelta(seconds=lease_seconds)
        message.attempt_count += 1
        message.cycle_attempt_count += 1
        message.version += 1
        message.save()
        attempt = DeliveryAttempt.objects.create(
            outbox=message,
            claim_token=message.claim_token,
            number=message.attempt_count,
            lease_expires_at=message.lease_expires_at,
        )
        return OutboxClaim(message.pk, message.claim_token, attempt.pk)


def _owned_claim(claim, now):
    return (
        OutboxMessage.objects.select_for_update()
        .filter(
            pk=claim.message_id,
            status=OutboxMessage.Status.PROCESSING,
            claim_token=claim.token,
            lease_expires_at__gt=now,
        )
        .first()
    )


@transaction.atomic
def acknowledge(claim, document, receipt, *, now=None):
    now = now or timezone.now()
    message = _owned_claim(claim, now)
    if message is None:
        return False
    stored = DocumentExportReceipt.objects.create(
        outbox=message,
        request_revision_id=document.request_revision_id,
        provider=receipt.provider,
        document_id=receipt.document_id,
        idempotency_key=receipt.idempotency_key,
        payload_hash=receipt.payload_hash,
        accepted_at=receipt.accepted_at,
    )
    DeliveryAttemptResult.objects.create(
        attempt_id=claim.attempt_id,
        outcome=DeliveryAttemptResult.Outcome.ACCEPTED,
        receipt=stored,
    )
    message.status = OutboxMessage.Status.PROCESSED
    message.processed_at = now
    message.failure_code = ""
    message.last_error = ""
    message.version += 1
    _clear_claim(message)
    message.save()
    event = emit(
        "integration.export_accepted",
        "outbox_message",
        message.pk,
        {
            "receipt_id": str(stored.pk),
            "provider": receipt.provider,
            "document_id": receipt.document_id,
            "request_revision_id": str(document.request_revision_id),
        },
    )
    history = RequestHistory.objects.select_related("request__employee__user").get(
        event_id=message.event_id
    )
    notify(
        history.request.employee.user,
        "integration_receipt",
        "Экспорт заявки принят",
        "Демонстрационный адаптер принял документ. Это не подтверждение выплаты или подписания.",
        "hr_request",
        history.request_id,
        event,
    )
    return True


@transaction.atomic
def record_failure(claim, failure, *, now=None):
    now = now or timezone.now()
    message = _owned_claim(claim, now)
    if message is None:
        return False
    retry = failure.retryable and message.cycle_attempt_count < MAX_CYCLE_ATTEMPTS
    message.status = OutboxMessage.Status.PENDING if retry else OutboxMessage.Status.FAILED
    message.failure_code = failure.code
    message.last_error = failure.message
    if retry:
        message.available_at = now + timedelta(
            seconds=min(300, 5 * 2 ** (message.cycle_attempt_count - 1))
        )
    elif failure.retryable:
        message.last_error = (
            "Automatic retries are exhausted. Check the adapter and retry this export."
        )
    message.version += 1
    _clear_claim(message)
    message.save()
    DeliveryAttemptResult.objects.create(
        attempt_id=claim.attempt_id,
        outcome=DeliveryAttemptResult.Outcome.RETRY_SCHEDULED
        if retry
        else DeliveryAttemptResult.Outcome.FAILED,
        failure_code=message.failure_code,
        error_message=message.last_error,
        next_attempt_at=message.available_at if retry else None,
    )
    if not retry:
        _notify_terminal_failure(message)
    return True


def deliver_claim(claim, *, adapter=None):
    if connection.in_atomic_block:
        raise RuntimeError(
            "Deliver outside the application transaction so a receiver receipt can survive a worker crash."
        )
    adapter = adapter or MockDocumentologAdapter()
    try:
        document = build_export(claim.message_id)
        receipt = adapter.deliver(document)
        if (
            receipt.idempotency_key != document.idempotency_key
            or receipt.payload_hash != document.digest
            or not receipt.provider
            or len(receipt.provider) > 32
            or not receipt.document_id
            or len(receipt.document_id) > 128
            or timezone.is_naive(receipt.accepted_at)
        ):
            raise DeliveryFailure(
                "invalid_provider_receipt",
                "The adapter returned a receipt for different data. Check the adapter contract.",
                retryable=False,
            )
    except DeliveryFailure as failure:
        return record_failure(claim, failure)
    except Exception:
        logger.error("Provider execution failed for outbox message %s", claim.message_id)
        return record_failure(
            claim,
            DeliveryFailure(
                "provider_execution_failed",
                "The adapter could not complete the export. A retry is scheduled.",
                retryable=True,
            ),
        )
    return acknowledge(claim, document, receipt)


def process_once(*, adapter=None):
    if connection.in_atomic_block:
        raise RuntimeError("Run the outbox worker outside the application transaction.")
    claim = claim_next()
    if claim is None:
        return False
    deliver_claim(claim, adapter=adapter)
    return True
