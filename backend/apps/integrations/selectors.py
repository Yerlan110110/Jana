from apps.core.models import OutboxMessage

from .models import EntitySyncState, SourceImportBatch
from .permissions import operator_entities

EXPORT_TOPIC = "documentolog.export_request"


def visible_imports(user):
    return SourceImportBatch.objects.filter(
        legal_entity__in=operator_entities(user)
    ).select_related("legal_entity", "actor")


def visible_sources(user):
    return EntitySyncState.objects.filter(legal_entity__in=operator_entities(user)).select_related(
        "legal_entity", "last_accepted_batch"
    )


def visible_exports(user):
    return OutboxMessage.objects.filter(
        topic=EXPORT_TOPIC,
        event__requesthistory__request__employee__legal_entity__in=operator_entities(user),
    ).select_related(
        "event__requesthistory__request__employee",
        "export_receipt",
    )


def export_actions(message):
    if message.status == OutboxMessage.Status.FAILED or (
        message.status == OutboxMessage.Status.PENDING and message.failure_code
    ):
        return ["retry"]
    return []
