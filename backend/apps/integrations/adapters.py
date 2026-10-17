from django.db import transaction

from apps.core.models import OutboxMessage
from apps.hr_requests.models import HRRequest, RequestHistory, RequestRevision

from .contracts import DeliveryFailure, ExportDocument, ProviderReceipt
from .models import MockDeliveryFault, MockDocumentReceipt
from .selectors import EXPORT_TOPIC


def build_export(message_id):
    message = OutboxMessage.objects.select_related("event").get(pk=message_id)
    if message.topic != EXPORT_TOPIC:
        raise DeliveryFailure(
            "unsupported_topic", "Configure an adapter for this outbox topic.", retryable=False
        )
    history = RequestHistory.objects.filter(
        event=message.event, action="approved", to_status=HRRequest.Status.APPROVED
    ).first()
    if history is None:
        raise DeliveryFailure(
            "invalid_approval_evidence",
            "Resolve the missing final approval evidence.",
            retryable=False,
        )
    revision = RequestRevision.objects.filter(
        request_id=history.request_id, number=history.submission_number
    ).first()
    if revision is None:
        raise DeliveryFailure(
            "missing_submitted_revision",
            "Resolve the missing submitted request revision.",
            retryable=False,
        )
    payload = {
        "schema_version": 1,
        "request_id": str(history.request_id),
        "request_revision_id": str(revision.pk),
        "submission_number": revision.number,
        "submitted": revision.payload,
        "decision": {
            "event_id": str(history.event_id),
            "request_version": history.version,
            "status": history.to_status,
            "actor_id": str(history.actor_id),
            "actor_name": history.actor_name,
            "comment": history.comment,
            "decided_at": history.created_at.isoformat(),
        },
    }
    return ExportDocument(message.pk, revision.pk, payload)


class MockDocumentologAdapter:
    provider = "mock_documentolog"

    def deliver(self, document: ExportDocument) -> ProviderReceipt:
        failure = None
        with transaction.atomic():
            receipt = MockDocumentReceipt.objects.filter(
                idempotency_key=document.idempotency_key
            ).first()
            if receipt is None:
                fault = (
                    MockDeliveryFault.objects.select_for_update()
                    .filter(outbox_id=document.outbox_id)
                    .first()
                )
                if fault and fault.permanent_failure:
                    failure = DeliveryFailure(
                        "mock_permanent_rejection",
                        "The mock adapter rejected this export. Clear the demo fault before retrying.",
                        retryable=False,
                    )
                elif fault and fault.transient_failures_remaining:
                    fault.transient_failures_remaining -= 1
                    fault.save(update_fields=["transient_failures_remaining", "updated_at"])
                    failure = DeliveryFailure(
                        "mock_temporary_unavailable",
                        "The mock adapter is temporarily unavailable. A retry is scheduled.",
                        retryable=True,
                    )
                else:
                    receipt, _ = MockDocumentReceipt.objects.get_or_create(
                        idempotency_key=document.idempotency_key,
                        defaults={
                            "document_id": f"mockdoc-{document.outbox_id}",
                            "payload_hash": document.digest,
                            "payload": document.payload,
                        },
                    )
        if failure:
            raise failure
        if receipt.payload_hash != document.digest:
            raise DeliveryFailure(
                "receiver_key_conflict",
                "The receiver already accepted different data under this export identity. Investigate the source revision.",
                retryable=False,
            )
        return ProviderReceipt(
            provider=self.provider,
            document_id=receipt.document_id,
            idempotency_key=receipt.idempotency_key,
            payload_hash=receipt.payload_hash,
            accepted_at=receipt.created_at,
        )
