import hashlib
import json

from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from rest_framework.exceptions import ValidationError
from rest_framework.renderers import JSONRenderer

from .errors import Conflict
from .models import IdempotencyRecord


@transaction.atomic
def execute(user, key, command, payload, operation):
    if (
        not key
        or len(key) > 128
        or not key.isascii()
        or not key.isprintable()
        or any(char.isspace() for char in key)
    ):
        raise ValidationError(
            {
                "idempotency_key": "Supply an ASCII Idempotency-Key of 1 to 128 characters, without whitespace."
            }
        )
    encoded = json.dumps(payload, cls=DjangoJSONEncoder, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(encoded.encode()).hexdigest()
    record, _ = IdempotencyRecord.objects.get_or_create(
        actor=user,
        key=key,
        defaults={"command": command, "payload_hash": digest},
    )
    record = IdempotencyRecord.objects.select_for_update().get(pk=record.pk)
    if record.command != command or record.payload_hash != digest:
        raise Conflict(
            "This Idempotency-Key has already been used for a different command or payload."
        )
    if record.response_status is not None:
        return record.response_data, record.response_status, True
    data, response_status = operation()
    record.response_data = json.loads(JSONRenderer().render(data))
    record.response_status = response_status
    record.save(update_fields=["response_data", "response_status", "updated_at"])
    return record.response_data, response_status, False
