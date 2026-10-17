from django_filters import rest_framework as filters

from .models import EntitySyncState, SourceImportBatch


class SourceImportFilter(filters.FilterSet):
    legal_entity = filters.UUIDFilter(field_name="legal_entity_id")

    class Meta:
        model = SourceImportBatch
        fields = ["legal_entity", "status", "source_revision"]


class SourceStateFilter(filters.FilterSet):
    legal_entity = filters.UUIDFilter(field_name="legal_entity_id")

    class Meta:
        model = EntitySyncState
        fields = ["legal_entity"]
