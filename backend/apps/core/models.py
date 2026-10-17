import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class TimestampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class AppendOnlyQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ValidationError("Historical records cannot be updated.")

    def delete(self):
        raise ValidationError("Historical records cannot be deleted.")


class AppendOnlyModel(TimestampedModel):
    objects = AppendOnlyQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("Historical records cannot be updated.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Historical records cannot be deleted.")


class DomainEvent(AppendOnlyModel):
    event_type = models.CharField(max_length=100, db_index=True)
    aggregate_type = models.CharField(max_length=80)
    aggregate_id = models.UUIDField(db_index=True)
    payload = models.JSONField(default=dict)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["aggregate_type", "aggregate_id", "created_at"])]


class OutboxMessage(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        PROCESSED = "processed", "Processed"
        FAILED = "failed", "Failed"

    event = models.ForeignKey(DomainEvent, on_delete=models.PROTECT, related_name="outbox_messages")
    topic = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=Status, default=Status.PENDING)
    attempt_count = models.PositiveIntegerField(default=0)
    available_at = models.DateTimeField(default=timezone.now)
    last_error = models.TextField(blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["event", "topic"], name="outbox_event_topic_unique")
        ]
        indexes = [models.Index(fields=["status", "available_at"])]
        ordering = ["available_at", "id"]


class IdempotencyRecord(TimestampedModel):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    key = models.CharField(max_length=128)
    command = models.CharField(max_length=180)
    payload_hash = models.CharField(max_length=64)
    response_data = models.JSONField(null=True)
    response_status = models.PositiveSmallIntegerField(null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["actor", "key"], name="command_actor_key_unique")
        ]
