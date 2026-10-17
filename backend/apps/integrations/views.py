from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.idempotency import execute
from apps.core.models import OutboxMessage

from .filters import SourceImportFilter, SourceStateFilter
from .imports import import_snapshot
from .models import EntitySyncState, SourceImportBatch
from .permissions import require_operator_entity
from .selectors import visible_exports, visible_imports, visible_sources
from .serializers import (
    EntitySyncStateSerializer,
    ExportCommandSerializer,
    ExportDetailSerializer,
    ExportSerializer,
    ImportAcceptedSerializer,
    ImportRejectedSerializer,
    ImportSnapshotSerializer,
    MockFaultSerializer,
    SourceImportBatchSerializer,
    SourceImportDetailSerializer,
)
from .services import configure_mock_fault, retry_export

IDEMPOTENCY_HEADER = OpenApiParameter(
    "Idempotency-Key", str, OpenApiParameter.HEADER, required=True
)


class ImportSnapshotView(APIView):
    @extend_schema(
        request=ImportSnapshotSerializer,
        responses={
            200: ImportAcceptedSerializer,
            201: ImportAcceptedSerializer,
            400: ImportRejectedSerializer,
            409: ImportRejectedSerializer,
        },
        parameters=[IDEMPOTENCY_HEADER],
    )
    def post(self, request):
        serializer = ImportSnapshotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        snapshot = serializer.snapshot()
        require_operator_entity(request.user, snapshot.legal_entity_id)

        def run():
            outcome = import_snapshot(request.user, snapshot)
            if outcome.http_status >= 400:
                return {
                    "code": outcome.batch.error_code,
                    "message": outcome.batch.error_message,
                    "field_errors": outcome.batch.error_fields,
                    "request_id": getattr(request, "request_id", None),
                    "integration_audit_id": str(outcome.batch.pk),
                }, outcome.http_status
            return {
                "batch": SourceImportBatchSerializer(outcome.batch).data,
                "source_replayed": outcome.source_replayed,
            }, outcome.http_status

        data, status_code, replayed = execute(
            request.user,
            request.headers.get("Idempotency-Key"),
            "integration.import_snapshot",
            snapshot.canonical(),
            run,
        )
        return Response(
            data, status=status_code, headers={"Idempotency-Replayed": str(replayed).lower()}
        )


class SourceImportViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SourceImportBatchSerializer
    filterset_class = SourceImportFilter
    ordering_fields = ["created_at", "source_revision", "captured_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return SourceImportBatch.objects.none()
        return visible_imports(self.request.user)

    def get_serializer_class(self):
        return (
            SourceImportDetailSerializer
            if self.action == "retrieve"
            else SourceImportBatchSerializer
        )


class SourceStateViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EntitySyncStateSerializer
    filterset_class = SourceStateFilter

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return EntitySyncState.objects.none()
        return visible_sources(self.request.user)


class ExportViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ExportSerializer
    filterset_fields = ["status"]
    ordering_fields = ["created_at", "available_at", "processed_at", "attempt_count"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return OutboxMessage.objects.none()
        return visible_exports(self.request.user).prefetch_related("delivery_attempts__result")

    def get_serializer_class(self):
        return ExportDetailSerializer if self.action == "retrieve" else ExportSerializer

    def _command(self, request, pk, command, payload, operation):
        if not visible_exports(request.user).filter(pk=pk).exists():
            raise NotFound()

        def run():
            result = operation()
            return ExportDetailSerializer(result).data, 200

        data, status_code, replayed = execute(
            request.user,
            request.headers.get("Idempotency-Key"),
            f"integration.export.{pk}.{command}",
            payload,
            run,
        )
        return Response(
            data, status=status_code, headers={"Idempotency-Replayed": str(replayed).lower()}
        )

    @extend_schema(
        request=ExportCommandSerializer,
        responses=ExportDetailSerializer,
        parameters=[IDEMPOTENCY_HEADER],
    )
    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        serializer = ExportCommandSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._command(
            request,
            pk,
            "retry",
            serializer.validated_data,
            lambda: retry_export(request.user, pk, serializer.validated_data["expected_version"]),
        )

    @extend_schema(
        request=MockFaultSerializer,
        responses=ExportDetailSerializer,
        parameters=[IDEMPOTENCY_HEADER],
    )
    @action(detail=True, methods=["post"], url_path="mock-fault")
    def mock_fault(self, request, pk=None):
        serializer = MockFaultSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._command(
            request,
            pk,
            "mock_fault",
            serializer.validated_data,
            lambda: configure_mock_fault(request.user, pk, **serializer.validated_data),
        )
