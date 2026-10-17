from django.db import connection

from .models import DomainEvent


def emit(event_type, aggregate_type, aggregate_id, payload, actor=None):
    if not connection.in_atomic_block:
        raise RuntimeError("Domain events must be emitted within the business transaction.")
    return DomainEvent.objects.create(
        event_type=event_type,
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        payload=payload,
        actor=actor,
    )
