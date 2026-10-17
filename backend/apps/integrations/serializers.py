from datetime import timedelta

from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.models import OutboxMessage
from apps.core.serializers import StrictSerializer

from .contracts import BalanceReversal, EmployeeSnapshot, ImportSnapshot
from .models import (
    DeliveryAttempt,
    DeliveryAttemptResult,
    DocumentExportReceipt,
    EntitySyncState,
    SourceImportBatch,
)
from .selectors import export_actions


class BalanceReversalSerializer(StrictSerializer):
    request_id = serializers.UUIDField()
    reason = serializers.CharField(min_length=5, max_length=500)


class EmployeeSnapshotSerializer(StrictSerializer):
    external_id = serializers.CharField(max_length=80)
    full_name = serializers.CharField(max_length=200)
    position = serializers.CharField(max_length=200)
    department_code = serializers.CharField(max_length=50)
    manager_external_id = serializers.CharField(max_length=80, allow_null=True)
    hired_on = serializers.DateField()
    leave_balance = serializers.DecimalField(max_digits=7, decimal_places=2, min_value=0)
    balance_as_of = serializers.DateField()
    locale = serializers.ChoiceField(choices=[("ru", "Русский"), ("kk", "Қазақша")])
    is_active = serializers.BooleanField()
    incorporated_request_ids = serializers.ListField(child=serializers.UUIDField(), max_length=1000)
    balance_reversals = BalanceReversalSerializer(many=True, required=False, default=list)

    def validate(self, attrs):
        confirmations = attrs["incorporated_request_ids"]
        reversals = [item["request_id"] for item in attrs["balance_reversals"]]
        if len(set(confirmations)) != len(confirmations) or len(set(reversals)) != len(reversals):
            raise serializers.ValidationError("Include each balance request identity once.")
        if set(confirmations) & set(reversals):
            raise serializers.ValidationError(
                "A request cannot be incorporated and reversed in one snapshot."
            )
        return attrs


class ImportSnapshotSerializer(StrictSerializer):
    source = serializers.ChoiceField(choices=["mock_1c"])
    legal_entity_id = serializers.UUIDField()
    source_revision = serializers.IntegerField(min_value=1, max_value=2**53 - 1)
    captured_at = serializers.DateTimeField()
    employees = EmployeeSnapshotSerializer(many=True, allow_empty=False)

    def validate(self, attrs):
        employees = attrs["employees"]
        if len(employees) > 1000:
            raise serializers.ValidationError(
                {"employees": "Import at most 1000 employees in one normalized batch."}
            )
        identities = [employee["external_id"] for employee in employees]
        if len(set(identities)) != len(identities):
            raise serializers.ValidationError(
                {"employees": "Include each source employee identity once."}
            )
        if attrs["captured_at"] > timezone.now() + timedelta(minutes=5):
            raise serializers.ValidationError(
                {"captured_at": "Use the actual capture time, not a future timestamp."}
            )
        captured_date = timezone.localtime(attrs["captured_at"]).date()
        if any(employee["balance_as_of"] > captured_date for employee in employees):
            raise serializers.ValidationError(
                {"employees": "The balance date cannot be later than the source capture."}
            )
        return attrs

    def snapshot(self):
        values = dict(self.validated_data)
        employees = []
        for record in values.pop("employees"):
            record = dict(record)
            record["incorporated_request_ids"] = tuple(record["incorporated_request_ids"])
            record["balance_reversals"] = tuple(
                BalanceReversal(**item) for item in record["balance_reversals"]
            )
            employees.append(EmployeeSnapshot(**record))
        return ImportSnapshot(employees=tuple(employees), **values)


class SourceImportBatchSerializer(serializers.ModelSerializer):
    import_status = serializers.ChoiceField(
        source="status", choices=SourceImportBatch.Status, read_only=True
    )
    legal_entity_name = serializers.CharField(source="legal_entity.name", read_only=True)

    class Meta:
        model = SourceImportBatch
        fields = [
            "id",
            "legal_entity",
            "legal_entity_name",
            "source",
            "source_revision",
            "captured_at",
            "payload_hash",
            "employee_count",
            "import_status",
            "error_code",
            "error_message",
            "error_fields",
            "actor",
            "created_at",
        ]
        read_only_fields = fields


class SourceImportDetailSerializer(SourceImportBatchSerializer):
    payload = ImportSnapshotSerializer(read_only=True)

    class Meta(SourceImportBatchSerializer.Meta):
        fields = [*SourceImportBatchSerializer.Meta.fields, "payload"]
        read_only_fields = fields


class ImportAcceptedSerializer(serializers.Serializer):
    batch = SourceImportBatchSerializer()
    source_replayed = serializers.BooleanField()


class ImportRejectedSerializer(serializers.Serializer):
    code = serializers.CharField()
    message = serializers.CharField()
    field_errors = serializers.DictField()
    request_id = serializers.CharField(allow_null=True)
    integration_audit_id = serializers.UUIDField()


class EntitySyncStateSerializer(serializers.ModelSerializer):
    legal_entity_name = serializers.CharField(source="legal_entity.name", read_only=True)

    class Meta:
        model = EntitySyncState
        fields = [
            "id",
            "legal_entity",
            "legal_entity_name",
            "source",
            "last_revision",
            "last_captured_at",
            "last_accepted_batch",
            "updated_at",
        ]
        read_only_fields = fields


class ExportReceiptSerializer(serializers.ModelSerializer):
    acceptance_meaning = serializers.CharField(read_only=True, default="document_received_only")

    class Meta:
        model = DocumentExportReceipt
        fields = [
            "id",
            "provider",
            "document_id",
            "request_revision",
            "idempotency_key",
            "payload_hash",
            "accepted_at",
            "acceptance_meaning",
        ]
        read_only_fields = fields


class DeliveryAttemptResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryAttemptResult
        fields = [
            "outcome",
            "failure_code",
            "error_message",
            "next_attempt_at",
            "receipt",
            "created_at",
        ]
        read_only_fields = fields


class DeliveryAttemptSerializer(serializers.ModelSerializer):
    result = DeliveryAttemptResultSerializer(read_only=True, allow_null=True)

    class Meta:
        model = DeliveryAttempt
        fields = ["id", "number", "created_at", "lease_expires_at", "result"]
        read_only_fields = fields


class ExportSerializer(serializers.ModelSerializer):
    delivery_status = serializers.ChoiceField(
        source="status", choices=OutboxMessage.Status, read_only=True
    )
    request_id = serializers.UUIDField(source="event.requesthistory.request_id", read_only=True)
    employee_name = serializers.CharField(
        source="event.requesthistory.request.employee.full_name", read_only=True
    )
    export_receipt = ExportReceiptSerializer(read_only=True, allow_null=True)
    allowed_actions = serializers.SerializerMethodField()

    class Meta:
        model = OutboxMessage
        fields = [
            "id",
            "request_id",
            "employee_name",
            "topic",
            "delivery_status",
            "version",
            "attempt_count",
            "cycle_attempt_count",
            "available_at",
            "lease_expires_at",
            "last_error",
            "failure_code",
            "processed_at",
            "export_receipt",
            "allowed_actions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_allowed_actions(self, obj):
        return export_actions(obj)


class ExportDetailSerializer(ExportSerializer):
    delivery_attempts = DeliveryAttemptSerializer(many=True, read_only=True)

    class Meta(ExportSerializer.Meta):
        fields = [*ExportSerializer.Meta.fields, "delivery_attempts"]
        read_only_fields = fields


class ExportCommandSerializer(StrictSerializer):
    expected_version = serializers.IntegerField(min_value=1)


class MockFaultSerializer(ExportCommandSerializer):
    transient_failures = serializers.IntegerField(min_value=0, max_value=10, default=0)
    permanent_failure = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if attrs["transient_failures"] and attrs["permanent_failure"]:
            raise serializers.ValidationError("Choose either transient or permanent mock failure.")
        return attrs
