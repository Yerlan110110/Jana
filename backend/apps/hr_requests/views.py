from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response

from apps.core.idempotency import execute
from apps.identity.selectors import employee_for

from . import services
from .filters import RequestFilter
from .selectors import fulfillment_for, leave_projection, visible_requests
from .serializers import (
    DecisionSerializer,
    FulfillmentSerializer,
    LeaveProjectionSerializer,
    RequestCreateSerializer,
    RequestDetailSerializer,
    RequestEditSerializer,
    RequestSerializer,
    TransitionSerializer,
)

IDEMPOTENCY_HEADER = OpenApiParameter(
    "Idempotency-Key",
    str,
    OpenApiParameter.HEADER,
    required=True,
    description="Unique command key per authenticated user. Replays return the original result.",
)


class RequestViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = RequestSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    search_fields = ["reason", "employee__full_name"]
    filterset_class = RequestFilter
    ordering_fields = ["created_at", "submitted_at", "start_date", "amount"]

    def get_queryset(self):
        return visible_requests(self.request.user).prefetch_related("history", "revisions")

    def get_serializer_class(self):
        return RequestDetailSerializer if self.action == "retrieve" else RequestSerializer

    def _command(self, request, command, payload, operation, status_code=200):
        if command == "request.create" and employee_for(request.user) is None:
            raise PermissionDenied("An active employee profile is required.")
        if (
            "pk" in self.kwargs
            and not visible_requests(request.user).filter(pk=self.kwargs["pk"]).exists()
        ):
            raise NotFound()

        def run():
            result = operation()
            return RequestDetailSerializer(result, context={"request": request}).data, status_code

        data, response_status, replayed = execute(
            request.user, request.headers.get("Idempotency-Key"), command, payload, run
        )
        return Response(
            data, status=response_status, headers={"Idempotency-Replayed": str(replayed).lower()}
        )

    @extend_schema(
        request=RequestCreateSerializer,
        responses={201: RequestDetailSerializer},
        parameters=[IDEMPOTENCY_HEADER],
    )
    def create(self, request, *args, **kwargs):
        data = RequestCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return self._command(
            request,
            "request.create",
            data.validated_data,
            lambda: services.create(request.user, data.validated_data),
            201,
        )

    @extend_schema(
        request=RequestEditSerializer,
        responses=RequestDetailSerializer,
        parameters=[IDEMPOTENCY_HEADER],
    )
    def partial_update(self, request, *args, **kwargs):
        data = RequestEditSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        values = dict(data.validated_data)
        expected_version = values.pop("expected_version")
        return self._command(
            request,
            f"request.{self.kwargs['pk']}.edit",
            data.validated_data,
            lambda: services.update_draft(
                request.user, self.kwargs["pk"], expected_version, values
            ),
        )

    @extend_schema(
        request=TransitionSerializer,
        responses=RequestDetailSerializer,
        parameters=[IDEMPOTENCY_HEADER],
    )
    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        data = TransitionSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return self._command(
            request,
            f"request.{pk}.submit",
            data.validated_data,
            lambda: services.submit(request.user, pk, data.validated_data["expected_version"]),
        )

    def _decide(self, request, pk, action_name):
        data = DecisionSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return self._command(
            request,
            f"request.{pk}.{action_name}",
            data.validated_data,
            lambda: services.decide(request.user, pk, action=action_name, **data.validated_data),
        )

    @extend_schema(
        request=DecisionSerializer,
        responses=RequestDetailSerializer,
        parameters=[IDEMPOTENCY_HEADER],
    )
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._decide(request, pk, "approve")

    @extend_schema(
        request=DecisionSerializer,
        responses=RequestDetailSerializer,
        parameters=[IDEMPOTENCY_HEADER],
    )
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._decide(request, pk, "reject")

    @extend_schema(
        request=DecisionSerializer,
        responses=RequestDetailSerializer,
        parameters=[IDEMPOTENCY_HEADER],
    )
    @action(detail=True, methods=["post"], url_path="return-for-changes")
    def return_for_changes(self, request, pk=None):
        return self._decide(request, pk, "return_for_changes")

    @extend_schema(
        request=TransitionSerializer,
        responses=RequestDetailSerializer,
        parameters=[IDEMPOTENCY_HEADER],
    )
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        data = TransitionSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return self._command(
            request,
            f"request.{pk}.cancel",
            data.validated_data,
            lambda: services.cancel(request.user, pk, data.validated_data["expected_version"]),
        )

    @extend_schema(responses=LeaveProjectionSerializer)
    @action(detail=False, methods=["get"], url_path="leave-balance", pagination_class=None)
    def leave_balance(self, request):
        employee = employee_for(request.user)
        if employee is None:
            raise PermissionDenied("An active employee profile is required.")
        return Response(LeaveProjectionSerializer(leave_projection(employee)).data)

    @extend_schema(responses=FulfillmentSerializer)
    @action(detail=True, methods=["get"])
    def fulfillment(self, request, pk=None):
        return Response(FulfillmentSerializer(fulfillment_for(self.get_object())).data)
