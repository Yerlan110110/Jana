from django.conf import settings
from django.db import models

from apps.core.models import TimestampedModel


class Notification(TimestampedModel):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="notifications"
    )
    kind = models.CharField(max_length=80)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    target_type = models.CharField(max_length=80)
    target_id = models.UUIDField()
    event = models.ForeignKey("core.DomainEvent", on_delete=models.PROTECT, null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["event", "recipient"],
                condition=models.Q(event__isnull=False),
                name="notification_event_recipient_unique",
            )
        ]
        indexes = [models.Index(fields=["recipient", "read_at", "created_at"])]
