from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.idempotency import execute
from apps.identity.permissions import require_hr
from apps.identity.selectors import employee_for

from . import services
from .filters import CatalogFilter, EnrollmentFilter
from .models import Course
from .selectors import enrollment_summary, visible_courses, visible_enrollments
from .serializers import (
    AcademyVersionCommandSerializer,
    AssignmentSerializer,
    AttemptCommandSerializer,
    AttemptDetailSerializer,
    AttemptResultSerializer,
    CatalogCourseSerializer,
    CourseAdminSerializer,
    CourseAdminSummarySerializer,
    CourseCreateSerializer,
    CourseEditSerializer,
    CourseVersionAuthorSerializer,
    EnrollmentDetailSerializer,
    EnrollmentSerializer,
    EnrollmentSummarySerializer,
    LearningContentSerializer,
    LessonCommandSerializer,
)

IDEMPOTENCY_HEADER = OpenApiParameter(
    "Idempotency-Key",
    str,
    OpenApiParameter.HEADER,
    required=True,
    description="Use the same key and payload to recover the same command result after a lost response.",
)


def command_response(request, name, payload, operation):
    data, status, replayed = execute(
        request.user, request.headers.get("Idempotency-Key"), name, payload, operation
    )
    return Response(data, status=status, headers={"Idempotency-Replayed": str(replayed).lower()})


class CatalogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CatalogCourseSerializer
    filterset_class = CatalogFilter
    search_fields = [
        "slug",
        "published_version__title",
        "published_version__title_kk",
        "published_version__summary",
    ]
    ordering_fields = ["slug", "published_version__title", "published_version__published_at"]

    def get_queryset(self):
        return visible_courses(self.request.user).filter(availability=Course.Availability.PUBLISHED)


class CourseAdminViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CourseAdminSerializer
    search_fields = ["slug", "draft__title", "draft__title_kk"]
    filterset_fields = ["availability"]
    ordering_fields = ["slug", "updated_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Course.objects.none()
        require_hr(self.request.user)
        return visible_courses(self.request.user)

    def get_serializer_class(self):
        return CourseAdminSummarySerializer if self.action == "list" else CourseAdminSerializer

    def _command(self, request, name, payload, operation, status=200):
        require_hr(request.user)
        if "pk" in self.kwargs:
            services.author_course(request.user, self.kwargs["pk"])

        def run():
            return CourseAdminSerializer(operation()).data, status

        return command_response(request, name, payload, run)

    @extend_schema(
        request=CourseCreateSerializer,
        responses={201: CourseAdminSerializer},
        parameters=[IDEMPOTENCY_HEADER],
    )
    def create(self, request, *args, **kwargs):
        serializer = CourseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = dict(serializer.validated_data)
        require_hr(request.user, values.get("legal_entity"))
        if "legal_entity" not in values:
            author = employee_for(request.user)
            if author:
                values["legal_entity"] = author.legal_entity_id
        return self._command(
            request,
            "academy.course.create",
            values,
            lambda: services.create_course(request.user, **values),
            201,
        )

    @extend_schema(
        request=CourseEditSerializer,
        responses=CourseAdminSerializer,
        parameters=[IDEMPOTENCY_HEADER],
    )
    @action(detail=True, methods=["post"], url_path="save-draft")
    def save_draft(self, request, pk=None):
        serializer = CourseEditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._command(
            request,
            f"academy.course.{pk}.save_draft",
            serializer.validated_data,
            lambda: services.save_draft(request.user, pk, **serializer.validated_data),
        )

    @extend_schema(
        request=AcademyVersionCommandSerializer,
        responses=CourseAdminSerializer,
        parameters=[IDEMPOTENCY_HEADER],
    )
    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        serializer = AcademyVersionCommandSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._command(
            request,
            f"academy.course.{pk}.publish",
            serializer.validated_data,
            lambda: services.publish_course(request.user, pk, **serializer.validated_data),
        )

    def _availability(self, request, pk, availability):
        serializer = AcademyVersionCommandSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._command(
            request,
            f"academy.course.{pk}.{availability}",
            serializer.validated_data,
            lambda: services.set_availability(
                request.user, pk, availability=availability, **serializer.validated_data
            ),
        )

    @extend_schema(
        request=AcademyVersionCommandSerializer,
        responses=CourseAdminSerializer,
        parameters=[IDEMPOTENCY_HEADER],
    )
    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        return self._availability(request, pk, Course.Availability.ARCHIVED)

    @extend_schema(
        request=AcademyVersionCommandSerializer,
        responses=CourseAdminSerializer,
        parameters=[IDEMPOTENCY_HEADER],
    )
    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        return self._availability(request, pk, Course.Availability.PUBLISHED)

    @extend_schema(responses=CourseVersionAuthorSerializer(many=True))
    @action(detail=True, methods=["get"])
    def revisions(self, request, pk=None):
        course = self.get_object()
        page = self.paginate_queryset(course.revisions.select_related("course").all())
        return self.get_paginated_response(CourseVersionAuthorSerializer(page, many=True).data)


class EnrollmentViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = EnrollmentSerializer
    filterset_class = EnrollmentFilter
    search_fields = [
        "employee__full_name",
        "course_version__title",
        "course_version__title_kk",
        "course_version__course__slug",
    ]
    ordering_fields = ["created_at", "due_at", "completed_at", "course_version__title"]

    def get_queryset(self):
        return visible_enrollments(self.request.user)

    def get_serializer_class(self):
        return EnrollmentDetailSerializer if self.action == "retrieve" else EnrollmentSerializer

    def _progress_command(self, request, pk, name, payload, operation):
        services.owned_enrollment(request.user, pk)

        def run():
            return EnrollmentDetailSerializer(operation(), context={"request": request}).data, 200

        return command_response(request, f"academy.enrollment.{pk}.{name}", payload, run)

    @extend_schema(
        request=AssignmentSerializer,
        responses={201: EnrollmentDetailSerializer},
        parameters=[IDEMPOTENCY_HEADER],
    )
    def create(self, request, *args, **kwargs):
        serializer = AssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        services.assignment_scope(request.user, values["course_version"], values["employee"])

        def run():
            enrollment = services.assign(request.user, **values)
            return EnrollmentDetailSerializer(enrollment, context={"request": request}).data, 201

        return command_response(request, "academy.enrollment.assign", values, run)

    @extend_schema(
        request=AcademyVersionCommandSerializer,
        responses=EnrollmentDetailSerializer,
        parameters=[IDEMPOTENCY_HEADER],
    )
    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        serializer = AcademyVersionCommandSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._progress_command(
            request,
            pk,
            "start",
            serializer.validated_data,
            lambda: services.start(request.user, pk, **serializer.validated_data),
        )

    @extend_schema(
        request=LessonCommandSerializer,
        responses=EnrollmentDetailSerializer,
        parameters=[IDEMPOTENCY_HEADER],
    )
    @action(detail=True, methods=["post"], url_path="complete-lesson")
    def complete_lesson(self, request, pk=None):
        serializer = LessonCommandSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._progress_command(
            request,
            pk,
            "complete_lesson",
            serializer.validated_data,
            lambda: services.complete_lesson(request.user, pk, **serializer.validated_data),
        )

    @extend_schema(
        request=AttemptCommandSerializer,
        responses={201: AttemptResultSerializer},
        parameters=[IDEMPOTENCY_HEADER],
    )
    @action(detail=True, methods=["post"], url_path="submit-attempt")
    def submit_attempt(self, request, pk=None):
        serializer = AttemptCommandSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.owned_enrollment(request.user, pk)

        def run():
            attempt, enrollment = services.submit_attempt(
                request.user, pk, **serializer.validated_data
            )
            return AttemptResultSerializer(
                {"attempt": attempt, "enrollment": enrollment}, context={"request": request}
            ).data, 201

        return command_response(
            request, f"academy.enrollment.{pk}.submit_attempt", serializer.validated_data, run
        )

    @extend_schema(responses=LearningContentSerializer)
    @action(detail=True, methods=["get"], filter_backends=[])
    def learning(self, request, pk=None):
        enrollment = services.owned_enrollment(request.user, pk)
        return Response(LearningContentSerializer(enrollment.course_version).data)

    @extend_schema(responses=AttemptDetailSerializer(many=True), filters=False)
    @action(detail=True, methods=["get"], filter_backends=[])
    def attempts(self, request, pk=None):
        enrollment = self.get_object()
        page = self.paginate_queryset(enrollment.attempts.all())
        return self.get_paginated_response(AttemptDetailSerializer(page, many=True).data)

    @extend_schema(responses=EnrollmentSummarySerializer, filters=True)
    @action(detail=False, methods=["get"], pagination_class=None)
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        return Response(EnrollmentSummarySerializer(enrollment_summary(queryset)).data)
