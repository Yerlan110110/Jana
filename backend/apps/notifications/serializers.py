from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.hr_requests.models import HRRequest

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    request_status = serializers.SerializerMethodField()

    @extend_schema_field(serializers.ChoiceField(choices=HRRequest.Status.choices, allow_null=True))
    def get_request_status(self, notification):
        event = notification.event
        if (
            notification.kind != "request_status"
            or notification.target_type != "hr_request"
            or event is None
            or event.aggregate_type != "hr_request"
            or event.aggregate_id != notification.target_id
        ):
            return None
        status = event.payload.get("status")
        return status if status in HRRequest.Status.values else None

    class Meta:
        model = Notification
        fields = [
            "id",
            "kind",
            "title",
            "body",
            "request_status",
            "target_type",
            "target_id",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields
