from rest_framework import serializers

from apps.academy.serializers import EnrollmentSerializer, EnrollmentSummarySerializer
from apps.core.serializers import StrictSerializer
from apps.hr_requests.serializers import LeaveProjectionSerializer, RequestSerializer
from apps.identity.serializers import EmployeeSerializer
from apps.knowledge.serializers import GapCaseSerializer


class WorkbenchQuerySerializer(StrictSerializer):
    preview_limit = serializers.IntegerField(min_value=1, max_value=20, default=5)


class RequestPreviewSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    results = RequestSerializer(many=True)


class LearningPreviewSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    results = EnrollmentSerializer(many=True)


class GapPreviewSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    results = GapCaseSerializer(many=True)


class WorkbenchSerializer(serializers.Serializer):
    computed_at = serializers.DateTimeField()
    preview_limit = serializers.IntegerField()
    employee = EmployeeSerializer()
    leave = LeaveProjectionSerializer()
    learning_summary = EnrollmentSummarySerializer()
    returned_requests = RequestPreviewSerializer()
    draft_requests = RequestPreviewSerializer()
    requests_to_review = RequestPreviewSerializer()
    waiting_request_count = serializers.IntegerField()
    learning_outstanding = LearningPreviewSerializer()
    unavailable_learning_count = serializers.IntegerField()
    open_knowledge_cases = GapPreviewSerializer()
    knowledge_case_purpose = serializers.ChoiceField(choices=["track_own", "hr_response"])
    unread_notification_count = serializers.IntegerField()
