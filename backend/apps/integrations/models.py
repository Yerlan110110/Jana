from django.conf import settings
from django.db import models

from apps.core.models import AppendOnlyModel, TimestampedModel


class SourceImportBatch(AppendOnlyModel):
    class Status(models.TextChoices):
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    legal_entity = models.ForeignKey("identity.LegalEntity", on_delete=models.PROTECT)
    source = models.CharField(max_length=32, default="mock_1c")
    source_revision = models.PositiveBigIntegerField()
    captured_at = models.DateTimeField()
    payload_hash = models.CharField(max_length=64)
    payload = models.JSONField()
    employee_count = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=Status)
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.CharField(max_length=500, blank=True)
    error_fields = models.JSONField(default=dict)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)

    class Meta:
        ordering = ["-created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["legal_entity", "source", "source_revision"],
                condition=models.Q(status="accepted"),
                name="accepted_source_revision_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(source_revision__gt=0), name="source_revision_positive"
            ),
        ]


class EntitySyncState(TimestampedModel):
    legal_entity = models.OneToOneField(
        "identity.LegalEntity", on_delete=models.PROTECT, related_name="integration_sync_state"
    )
    source = models.CharField(max_length=32, default="mock_1c")
    last_revision = models.PositiveBigIntegerField(default=0)
    last_captured_at = models.DateTimeField(null=True, blank=True)
    last_accepted_batch = models.ForeignKey(
        SourceImportBatch, on_delete=models.PROTECT, null=True, blank=True
    )

    class Meta:
        permissions = [("operate_integrations", "Operate scoped HR integration adapters")]
        ordering = ["legal_entity_id"]


class EmployeeImportState(TimestampedModel):
    employee = models.OneToOneField(
        "identity.Employee", on_delete=models.PROTECT, related_name="integration_import_state"
    )
    last_accepted_batch = models.ForeignKey(SourceImportBatch, on_delete=models.PROTECT)


class DemoOperatorGrant(AppendOnlyModel):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    permission = models.ForeignKey("auth.Permission", on_delete=models.PROTECT)

    class Meta:
        default_permissions = ()


class MockDocumentReceipt(AppendOnlyModel):
    idempotency_key = models.CharField(max_length=128, unique=True)
    document_id = models.CharField(max_length=128, unique=True)
    payload_hash = models.CharField(max_length=64)
    payload = models.JSONField()


class DocumentExportReceipt(AppendOnlyModel):
    outbox = models.OneToOneField(
        "core.OutboxMessage", on_delete=models.PROTECT, related_name="export_receipt"
    )
    request_revision = models.ForeignKey("hr_requests.RequestRevision", on_delete=models.PROTECT)
    provider = models.CharField(max_length=32)
    document_id = models.CharField(max_length=128)
    idempotency_key = models.CharField(max_length=128, unique=True)
    payload_hash = models.CharField(max_length=64)
    accepted_at = models.DateTimeField()


class DeliveryAttempt(AppendOnlyModel):
    outbox = models.ForeignKey(
        "core.OutboxMessage", on_delete=models.PROTECT, related_name="delivery_attempts"
    )
    claim_token = models.UUIDField(unique=True)
    number = models.PositiveIntegerField()
    lease_expires_at = models.DateTimeField()

    class Meta:
        ordering = ["number"]
        constraints = [
            models.UniqueConstraint(fields=["outbox", "number"], name="delivery_attempt_unique")
        ]


class DeliveryAttemptResult(AppendOnlyModel):
    class Outcome(models.TextChoices):
        ACCEPTED = "accepted", "Accepted by the document adapter"
        RETRY_SCHEDULED = "retry_scheduled", "Retry scheduled"
        FAILED = "failed", "Operator action required"
        LEASE_EXPIRED = "lease_expired", "Worker claim expired"

    attempt = models.OneToOneField(DeliveryAttempt, on_delete=models.PROTECT, related_name="result")
    outcome = models.CharField(max_length=24, choices=Outcome)
    failure_code = models.CharField(max_length=64, blank=True)
    error_message = models.CharField(max_length=500, blank=True)
    next_attempt_at = models.DateTimeField(null=True, blank=True)
    receipt = models.ForeignKey(
        DocumentExportReceipt, on_delete=models.PROTECT, null=True, blank=True
    )


class MockDeliveryFault(TimestampedModel):
    outbox = models.OneToOneField(
        "core.OutboxMessage", on_delete=models.PROTECT, related_name="mock_delivery_fault"
    )
    transient_failures_remaining = models.PositiveSmallIntegerField(default=0)
    permanent_failure = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(transient_failures_remaining__lte=10),
                name="mock_failure_budget_bounded",
            ),
            models.CheckConstraint(
                condition=models.Q(permanent_failure=False)
                | models.Q(transient_failures_remaining=0),
                name="mock_failure_mode_exclusive",
            ),
        ]
