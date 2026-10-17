from django.conf import settings
from django.db import models

from apps.core.models import AppendOnlyModel, TimestampedModel


class HRRequest(TimestampedModel):
    class Kind(models.TextChoices):
        LEAVE = "leave", "Leave"
        ADVANCE = "advance", "Salary advance"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING_MANAGER = "pending_manager", "Pending manager"
        PENDING_HR = "pending_hr", "Pending HR"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        RETURNED = "returned", "Returned for changes"
        CANCELLED = "cancelled", "Cancelled"

    employee = models.ForeignKey(
        "identity.Employee", on_delete=models.PROTECT, related_name="hr_requests"
    )
    kind = models.CharField(max_length=16, choices=Kind)
    status = models.CharField(max_length=24, choices=Status, default=Status.DRAFT)
    version = models.PositiveIntegerField(default=1)
    reason = models.TextField(blank=True, max_length=2000)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    leave_days = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, blank=True)
    requested_payment_date = models.DateField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    submission_number = models.PositiveIntegerField(default=0)
    assigned_manager = models.ForeignKey(
        "identity.Employee",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="assigned_hr_requests",
    )

    class Meta:
        ordering = ["-created_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(version__gte=1), name="request_version_positive"
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        kind="leave",
                        start_date__isnull=False,
                        end_date__isnull=False,
                        leave_days__isnull=False,
                        leave_days__gt=0,
                        amount__isnull=True,
                        currency="",
                        requested_payment_date__isnull=True,
                    )
                    & models.Q(end_date__gte=models.F("start_date"))
                )
                | models.Q(
                    kind="advance",
                    start_date__isnull=True,
                    end_date__isnull=True,
                    leave_days__isnull=True,
                    amount__isnull=False,
                    amount__gt=0,
                    currency="KZT",
                    requested_payment_date__isnull=False,
                ),
                name="request_kind_fields_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    status__in=[
                        "draft",
                        "pending_manager",
                        "pending_hr",
                        "approved",
                        "rejected",
                        "returned",
                        "cancelled",
                    ]
                ),
                name="request_status_valid",
            ),
        ]
        indexes = [
            models.Index(fields=["employee", "status"]),
            models.Index(fields=["status", "submitted_at"]),
        ]


class RequestRevision(AppendOnlyModel):
    request = models.ForeignKey(HRRequest, on_delete=models.PROTECT, related_name="revisions")
    number = models.PositiveIntegerField()
    payload = models.JSONField()
    assigned_manager = models.ForeignKey(
        "identity.Employee", on_delete=models.PROTECT, null=True, blank=True
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["request", "number"], name="request_revision_number_unique"
            )
        ]
        ordering = ["number"]


class RequestHistory(AppendOnlyModel):
    request = models.ForeignKey(HRRequest, on_delete=models.PROTECT, related_name="history")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    actor_name = models.CharField(max_length=200)
    action = models.CharField(max_length=40)
    from_status = models.CharField(max_length=24, blank=True)
    to_status = models.CharField(max_length=24)
    version = models.PositiveIntegerField()
    comment = models.TextField(blank=True, max_length=2000)
    submission_number = models.PositiveIntegerField(default=0)
    event = models.OneToOneField("core.DomainEvent", on_delete=models.PROTECT)

    class Meta:
        ordering = ["created_at", "id"]


class LeaveBalanceIncorporation(TimestampedModel):
    class State(models.TextChoices):
        INCORPORATED = "incorporated", "Included in the official source balance"
        REVERSED = "reversed", "Source reversed the incorporation"

    request = models.OneToOneField(
        HRRequest, on_delete=models.PROTECT, related_name="balance_incorporation"
    )
    request_revision = models.ForeignKey(RequestRevision, on_delete=models.PROTECT)
    leave_days = models.DecimalField(max_digits=7, decimal_places=2)
    state = models.CharField(max_length=16, choices=State)
    source = models.CharField(max_length=32, default="mock_1c")
    source_revision = models.PositiveBigIntegerField()
    source_batch_id = models.UUIDField()
    confirmed_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(leave_days__gt=0), name="incorporated_leave_days_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(state__in=["incorporated", "reversed"]),
                name="leave_incorporation_state_valid",
            ),
        ]
