import pytest
from django.db import transaction

from apps.core.events import emit
from apps.notifications.models import Notification
from apps.notifications.services import notify

pytestmark = pytest.mark.django_db


def test_notification_is_owned_and_mark_read_is_idempotent(api_client, employees):
    owner = employees["employee"].user
    with transaction.atomic():
        event = emit("example.created", "employee", employees["employee"].pk, {}, actor=owner)
        message = notify(
            owner, "example", "Title", "Body", "employee", employees["employee"].pk, event
        )
        same = notify(
            owner, "example", "Title", "Body", "employee", employees["employee"].pk, event
        )
    assert same.pk == message.pk
    api_client.force_authenticate(employees["manager"].user)
    assert api_client.get("/api/v1/notifications/").data["count"] == 0
    assert api_client.post(f"/api/v1/notifications/{message.pk}/read/").status_code == 404
    api_client.force_authenticate(owner)
    first = api_client.post(f"/api/v1/notifications/{message.pk}/read/")
    second = api_client.post(f"/api/v1/notifications/{message.pk}/read/")
    assert first.status_code == 200
    assert first.data["read_at"] == second.data["read_at"]
    assert Notification.objects.count() == 1
