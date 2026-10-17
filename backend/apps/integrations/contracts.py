import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from django.core.serializers.json import DjangoJSONEncoder


def canonical_json(value):
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder, sort_keys=True))


def payload_hash(value):
    encoded = json.dumps(canonical_json(value), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode()).hexdigest()


@dataclass(frozen=True)
class BalanceReversal:
    request_id: UUID
    reason: str


@dataclass(frozen=True)
class EmployeeSnapshot:
    external_id: str
    full_name: str
    position: str
    department_code: str
    manager_external_id: str | None
    hired_on: date
    leave_balance: Decimal
    balance_as_of: date
    locale: str
    is_active: bool
    incorporated_request_ids: tuple[UUID, ...]
    balance_reversals: tuple[BalanceReversal, ...]


@dataclass(frozen=True)
class ImportSnapshot:
    legal_entity_id: UUID
    source_revision: int
    captured_at: datetime
    employees: tuple[EmployeeSnapshot, ...]
    source: str = "mock_1c"

    def canonical(self):
        value = asdict(self)
        value["employees"] = sorted(value["employees"], key=lambda item: item["external_id"])
        for employee in value["employees"]:
            employee["incorporated_request_ids"] = sorted(
                employee["incorporated_request_ids"], key=str
            )
            employee["balance_reversals"] = sorted(
                employee["balance_reversals"], key=lambda item: str(item["request_id"])
            )
        return canonical_json(value)


@dataclass(frozen=True)
class ExportDocument:
    outbox_id: UUID
    request_revision_id: UUID
    payload: dict

    @property
    def idempotency_key(self):
        return f"janamen-documentolog-{self.outbox_id}"

    @property
    def digest(self):
        return payload_hash(self.payload)


@dataclass(frozen=True)
class ProviderReceipt:
    provider: str
    document_id: str
    idempotency_key: str
    payload_hash: str
    accepted_at: datetime


@dataclass(frozen=True)
class OutboxClaim:
    message_id: UUID
    token: UUID
    attempt_id: UUID


class DeliveryFailure(Exception):
    def __init__(self, code, message, *, retryable):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
