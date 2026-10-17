from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import StrictSerializer

from .models import HRRequest, RequestHistory, RequestRevision
from .services import allowed_actions


class RequestCreateSerializer(StrictSerializer):
    kind = serializers.ChoiceField(choices=HRRequest.Kind.choices)
    reason = serializers.CharField(max_length=2000, allow_blank=True, default="")
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    currency = serializers.ChoiceField(choices=["KZT"], required=False)
    requested_payment_date = serializers.DateField(required=False, allow_null=True)


class RequestEditSerializer(StrictSerializer):
    expected_version = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(max_length=2000, allow_blank=True, required=False)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    currency = serializers.ChoiceField(choices=["KZT"], required=False)
    requested_payment_date = serializers.DateField(required=False)


class TransitionSerializer(StrictSerializer):
    expected_version = serializers.IntegerField(min_value=1)


class DecisionSerializer(TransitionSerializer):
    comment = serializers.CharField(max_length=2000, allow_blank=True, default="")


class RequestHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = RequestHistory
        fields = [
            "id",
            "actor",
            "actor_name",
            "action",
            "from_status",
            "to_status",
            "version",
            "comment",
            "submission_number",
            "created_at",
        ]


class RequestRevisionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RequestRevision
        fields = ["id", "number", "payload", "assigned_manager", "created_at"]


class RequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    allowed_actions = serializers.SerializerMethodField()

    class Meta:
        model = HRRequest
        fields = [
            "id",
            "employee",
            "employee_name",
            "kind",
            "status",
            "version",
            "reason",
            "start_date",
            "end_date",
            "leave_days",
            "amount",
            "currency",
            "requested_payment_date",
            "submitted_at",
            "submission_number",
            "assigned_manager",
            "allowed_actions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_allowed_actions(self, instance):
        return allowed_actions(self.context["request"].user, instance)


class RequestDetailSerializer(RequestSerializer):
    history = RequestHistorySerializer(many=True, read_only=True)
    revisions = RequestRevisionSerializer(many=True, read_only=True)

    class Meta(RequestSerializer.Meta):
        fields = [*RequestSerializer.Meta.fields, "history", "revisions"]
        read_only_fields = fields


class LeaveProjectionSerializer(serializers.Serializer):
    official_balance = serializers.DecimalField(max_digits=9, decimal_places=2)
    portal_reserved_days = serializers.DecimalField(max_digits=9, decimal_places=2)
    source_incorporated_days = serializers.DecimalField(max_digits=9, decimal_places=2)
    projected_balance = serializers.DecimalField(max_digits=9, decimal_places=2)
    balance_as_of = serializers.DateField()
    day_count_convention = serializers.CharField()
