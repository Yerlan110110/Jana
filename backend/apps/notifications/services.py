from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound

from .models import Notification


def notify(recipient, kind, title, body, target_type, target_id, event=None):
    values = {
        "kind": kind,
        "title": title,
        "body": body,
        "target_type": target_type,
        "target_id": target_id,
    }
    if event:
        message, _ = Notification.objects.get_or_create(
            recipient=recipient, event=event, defaults=values
        )
        return message
    return Notification.objects.create(recipient=recipient, **values)


@transaction.atomic
def mark_read(user, notification_id):
    message = (
        Notification.objects.select_for_update().filter(pk=notification_id, recipient=user).first()
    )
    if message is None:
        raise NotFound()
    if message.read_at is None:
        message.read_at = timezone.now()
        message.save(update_fields=["read_at", "updated_at"])
    return message
