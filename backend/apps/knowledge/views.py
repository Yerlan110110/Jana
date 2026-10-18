from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from apps.core.idempotency import execute
from apps.identity.permissions import require_hr

from . import rehearsal, selectors, services
from .models import AssistantAnswer
from .presentation import present_answer, present_citation, present_policy_reference
from .serializers import (
    AnswerSerializer,
    CitationSerializer,
    DocumentAdminSerializer,
    DocumentCreateSerializer,
    DocumentReadSerializer,
    DocumentUpdateSerializer,
    EscalationSerializer,
    GapCaseSerializer,
    GapResolutionSerializer,
    KnowledgeVersionCommandSerializer,
    PolicyReferenceSerializer,
    PolicyUpdateAnswerSerializer,
    PolicyUpdateAttemptResultSerializer,
    PolicyUpdateDetailSerializer,
    PolicyUpdateListSerializer,
    ProviderErrorSerializer,
    QuestionSerializer,
    RehearsalRequestSerializer,
    RehearsalResponseSerializer,
    RevisionSerializer,
)


class HRKnowledgePermission(BasePermission):
    def has_permission(self, request, view):
        selectors.require_active_actor(request.user)
        require_hr(request.user)
        return True


class AssistantThrottle(UserRateThrottle):
    scope = "assistant"


COMMAND_PARAMETERS = [
    OpenApiParameter("Idempotency-Key", str, OpenApiParameter.HEADER, required=True)
]


def _idempotent(request, command, operation):
    employee = selectors.require_active_actor(request.user)
    payload = {
        "body": request.data,
        "actor_entity": str(employee.legal_entity_id) if employee else None,
        "actor_role": request.user.role,
    }
    data, response_status, replayed = execute(
        request.user,
        request.headers.get("Idempotency-Key"),
        command,
        payload,
        operation,
    )
    return Response(
        data, status=response_status, headers={"Idempotency-Replayed": str(replayed).lower()}
    )


@extend_schema_view(
    get=extend_schema(
        tags=["Knowledge"],
        description="Only effective published revisions visible to the active employee are returned.",
    )
)
class DocumentListView(generics.ListAPIView):
    serializer_class = DocumentReadSerializer
    filterset_fields = ["current_revision__language", "current_revision__topic"]
    search_fields = ["current_revision__title", "current_revision__summary"]
    ordering_fields = ["current_revision__title", "current_revision__published_at"]
    ordering = ["current_revision__title", "id"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            from .models import KnowledgeDocument

            return KnowledgeDocument.objects.none()
        return selectors.accessible_documents(self.request.user)


@extend_schema_view(get=extend_schema(tags=["Knowledge"]))
class DocumentDetailView(generics.RetrieveAPIView):
    serializer_class = DocumentReadSerializer

    def get_queryset(self):
        return selectors.accessible_documents(self.request.user)


class CitationView(APIView):
    @extend_schema(tags=["Knowledge"], responses=CitationSerializer)
    def get(self, request, pk):
        chunk = get_object_or_404(selectors.accessible_chunks(request.user), pk=pk)
        return Response(CitationSerializer(present_citation(chunk)).data)


class PolicyUpdateListView(generics.ListAPIView):
    serializer_class = PolicyUpdateListSerializer
    filter_backends = []

    def get_queryset(self):
        return selectors.visible_policy_updates(self.request.user)


class PolicyUpdateDetailView(APIView):
    @extend_schema(tags=["Policy updates"], responses=PolicyUpdateDetailSerializer)
    def get(self, request, pk):
        assignment = selectors.own_policy_update(request.user, pk)
        if assignment is None:
            raise NotFound()
        return Response(PolicyUpdateDetailSerializer(assignment).data)


class PolicyUpdateAttemptView(APIView):
    @extend_schema(
        tags=["Policy updates"],
        request=PolicyUpdateAnswerSerializer,
        responses=PolicyUpdateAttemptResultSerializer,
        parameters=COMMAND_PARAMETERS,
    )
    def post(self, request, pk):
        serializer = PolicyUpdateAnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = selectors.own_policy_update(request.user, pk)
        if assignment is None:
            raise NotFound()
        return _idempotent(
            request,
            f"knowledge.policy_update_answer:{pk}",
            lambda: (
                services.submit_policy_update_answer(
                    request.user,
                    pk,
                    serializer.validated_data["option_index"],
                    request.headers.get("Idempotency-Key", ""),
                ),
                200,
            ),
        )


@extend_schema_view(
    get=extend_schema(tags=["Knowledge administration"]),
    post=extend_schema(
        tags=["Knowledge administration"],
        request=DocumentCreateSerializer,
        responses={201: DocumentAdminSerializer},
        parameters=COMMAND_PARAMETERS,
    ),
)
class AdminDocumentListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, HRKnowledgePermission]
    serializer_class = DocumentAdminSerializer
    filterset_fields = ["state", "language", "topic", "audience"]
    search_fields = ["title", "summary"]
    ordering_fields = ["title", "updated_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            from .models import KnowledgeDocument

            return KnowledgeDocument.objects.none()
        return selectors.manageable_documents(self.request.user)

    def post(self, request, *args, **kwargs):
        serializer = DocumentCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return _idempotent(
            request,
            "knowledge.create_document",
            lambda: (
                DocumentAdminSerializer(
                    services.create_document(request.user, serializer.validated_data)
                ).data,
                201,
            ),
        )


class AdminDocumentDetailView(APIView):
    permission_classes = [IsAuthenticated, HRKnowledgePermission]

    @extend_schema(tags=["Knowledge administration"], responses=DocumentAdminSerializer)
    def get(self, request, pk):
        document = get_object_or_404(selectors.manageable_documents(request.user), pk=pk)
        return Response(DocumentAdminSerializer(document).data)

    @extend_schema(
        tags=["Knowledge administration"],
        request=DocumentUpdateSerializer,
        responses=DocumentAdminSerializer,
        parameters=COMMAND_PARAMETERS,
    )
    def patch(self, request, pk):
        serializer = DocumentUpdateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        get_object_or_404(selectors.manageable_documents(request.user), pk=pk)
        values = dict(serializer.validated_data)
        expected_version = values.pop("expected_version")
        return _idempotent(
            request,
            f"knowledge.update_document:{pk}",
            lambda: (
                DocumentAdminSerializer(
                    services.update_document(request.user, pk, expected_version, values)
                ).data,
                200,
            ),
        )


class PublishDocumentView(APIView):
    permission_classes = [IsAuthenticated, HRKnowledgePermission]

    @extend_schema(
        tags=["Knowledge administration"],
        request=KnowledgeVersionCommandSerializer,
        responses=DocumentAdminSerializer,
        parameters=COMMAND_PARAMETERS,
    )
    def post(self, request, pk):
        serializer = KnowledgeVersionCommandSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        get_object_or_404(selectors.manageable_documents(request.user), pk=pk)
        return _idempotent(
            request,
            f"knowledge.publish_document:{pk}",
            lambda: (
                DocumentAdminSerializer(
                    services.publish_document(
                        request.user, pk, serializer.validated_data["expected_version"]
                    )
                ).data,
                200,
            ),
        )


class ArchiveDocumentView(APIView):
    permission_classes = [IsAuthenticated, HRKnowledgePermission]

    @extend_schema(
        tags=["Knowledge administration"],
        request=KnowledgeVersionCommandSerializer,
        responses=DocumentAdminSerializer,
        parameters=COMMAND_PARAMETERS,
    )
    def post(self, request, pk):
        serializer = KnowledgeVersionCommandSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        get_object_or_404(selectors.manageable_documents(request.user), pk=pk)
        return _idempotent(
            request,
            f"knowledge.archive_document:{pk}",
            lambda: (
                DocumentAdminSerializer(
                    services.archive_document(
                        request.user, pk, serializer.validated_data["expected_version"]
                    )
                ).data,
                200,
            ),
        )


class RehearseDocumentView(APIView):
    permission_classes = [IsAuthenticated, HRKnowledgePermission]

    @extend_schema(
        tags=["Knowledge administration"],
        request=RehearsalRequestSerializer,
        responses=RehearsalResponseSerializer,
        description=(
            "Read-only preview. Replays scoped employee or explicit questions against the "
            "current corpus and a corpus where only this document's published chunks are "
            "replaced by its draft chunks. Writes nothing and requires no Idempotency-Key. "
            "A stale expected_version returns 409."
        ),
    )
    def post(self, request, pk):
        serializer = RehearsalRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = rehearsal.rehearse_document(request.user, pk, **serializer.validated_data)
        return Response(RehearsalResponseSerializer(result).data)


class AdminRevisionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, HRKnowledgePermission]
    serializer_class = RevisionSerializer
    filter_backends = []

    @extend_schema(
        tags=["Knowledge administration"],
        parameters=[OpenApiParameter("pk", str, OpenApiParameter.PATH)],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        document = get_object_or_404(
            selectors.manageable_documents(self.request.user), pk=self.kwargs["pk"]
        )
        return document.revisions.order_by("-number")


class AnswerListCreateView(generics.ListAPIView):
    serializer_class = AnswerSerializer
    throttle_classes = [AssistantThrottle]
    filter_backends = []

    def get_queryset(self):
        return selectors.own_answers(self.request.user)

    @extend_schema(tags=["AI Jana"], responses=AnswerSerializer(many=True))
    def get(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        answers = [present_answer(answer, request.user) for answer in page]
        return self.get_paginated_response(AnswerSerializer(answers, many=True).data)

    @extend_schema(
        tags=["AI Jana"],
        request=QuestionSerializer,
        responses={200: AnswerSerializer, 201: AnswerSerializer, 503: ProviderErrorSerializer},
        description="client_message_id deduplicates the persisted answer. A new id asks again. Extractive mode does not call an LLM. Provider failures return 503 with the persisted answer in the answer field.",
    )
    def post(self, request, *args, **kwargs):
        serializer = QuestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        answer, created = services.ask_question(request.user, **serializer.validated_data)
        data = AnswerSerializer(present_answer(answer, request.user)).data
        if data["mode"] == AssistantAnswer.Mode.UNAVAILABLE:
            return Response(
                {
                    "code": "provider_unavailable",
                    "message": data["message"],
                    "field_errors": {},
                    "request_id": getattr(request, "request_id", None),
                    "answer": data,
                },
                status=503,
            )
        return Response(data, status=201 if created else 200)


class AnswerDetailView(APIView):
    @extend_schema(tags=["AI Jana"], responses=AnswerSerializer)
    def get(self, request, pk):
        answer = get_object_or_404(selectors.own_answers(request.user), pk=pk)
        return Response(AnswerSerializer(present_answer(answer, request.user)).data)


@extend_schema_view(get=extend_schema(tags=["Knowledge gaps"]))
class GapCaseListView(generics.ListAPIView):
    serializer_class = GapCaseSerializer
    filterset_fields = ["status"]
    search_fields = ["question"]
    ordering_fields = ["created_at", "resolved_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            from .models import KnowledgeGapCase

            return KnowledgeGapCase.objects.none()
        return selectors.visible_gap_cases(self.request.user)

    @extend_schema(
        tags=["Knowledge gaps"],
        request=EscalationSerializer,
        responses={200: GapCaseSerializer, 201: GapCaseSerializer},
        parameters=COMMAND_PARAMETERS,
    )
    def post(self, request, *args, **kwargs):
        serializer = EscalationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        get_object_or_404(
            selectors.own_answers(request.user), pk=serializer.validated_data["answer_id"]
        )

        def operation():
            case, created = services.escalate_answer(request.user, **serializer.validated_data)
            return GapCaseSerializer(
                case, context={"request": request}
            ).data, 201 if created else 200

        return _idempotent(request, "knowledge.escalate_answer", operation)


@extend_schema_view(get=extend_schema(tags=["Knowledge gaps"]))
class GapCaseDetailView(generics.RetrieveAPIView):
    serializer_class = GapCaseSerializer

    def get_queryset(self):
        return selectors.visible_gap_cases(self.request.user)


class GapResolutionView(APIView):
    permission_classes = [IsAuthenticated, HRKnowledgePermission]

    @extend_schema(
        tags=["Knowledge gaps"],
        request=GapResolutionSerializer,
        responses=GapCaseSerializer,
        parameters=COMMAND_PARAMETERS,
    )
    def post(self, request, pk):
        serializer = GapResolutionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        case = get_object_or_404(selectors.visible_gap_cases(request.user), pk=pk)
        revision_id = serializer.validated_data.get("published_revision_id")
        if (
            revision_id is not None
            and selectors.policy_revision_for_case(request.user, case, revision_id) is None
        ):
            raise NotFound("Choose a published policy available to both you and the employee.")
        response = _idempotent(
            request,
            f"knowledge.resolve_gap:{pk}",
            lambda: (
                GapCaseSerializer(
                    services.resolve_gap_case(request.user, pk, **serializer.validated_data),
                    context={"request": request},
                ).data,
                200,
            ),
        )
        case.refresh_from_db()
        reference = present_policy_reference(case, request.user)
        response.data["policy_reference"] = (
            PolicyReferenceSerializer(reference).data if reference else None
        )
        return response


class GapPolicyReferenceView(APIView):
    @extend_schema(tags=["Knowledge gaps"], responses=PolicyReferenceSerializer)
    def get(self, request, pk):
        case = get_object_or_404(selectors.visible_gap_cases(request.user), pk=pk)
        reference = present_policy_reference(case, request.user)
        if reference is None:
            raise NotFound("This case has an individual answer without a policy reference.")
        return Response(PolicyReferenceSerializer(reference).data)
