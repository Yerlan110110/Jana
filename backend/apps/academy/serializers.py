from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import StrictSerializer

from .content import (
    AuthorQuestionSerializer,
    CourseDraftSerializer,
    LessonSerializer,
    QuestionSerializer,
)
from .models import Course, CourseVersion, Enrollment, LessonCompletion, QuizAttempt
from .selectors import enrollment_actions, enrollment_state, material_progress


class VersionCommandSerializer(StrictSerializer):
    expected_version = serializers.IntegerField(min_value=1)


class CourseCreateSerializer(StrictSerializer):
    slug = serializers.SlugField(max_length=80)
    legal_entity = serializers.UUIDField(required=False)
    draft = CourseDraftSerializer()


class CourseEditSerializer(VersionCommandSerializer):
    draft = CourseDraftSerializer()


class CourseAdminSummarySerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id",
            "slug",
            "title",
            "legal_entity",
            "owner",
            "availability",
            "version",
            "published_version",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_title(self, instance) -> str:
        return instance.draft.get("title", "")


class CourseAdminSerializer(CourseAdminSummarySerializer):
    draft = CourseDraftSerializer(read_only=True)

    class Meta(CourseAdminSummarySerializer.Meta):
        fields = [*CourseAdminSummarySerializer.Meta.fields, "draft"]
        read_only_fields = fields


class CourseVersionSummarySerializer(serializers.ModelSerializer):
    course_slug = serializers.CharField(source="course.slug", read_only=True)
    lesson_count = serializers.SerializerMethodField()
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = CourseVersion
        fields = [
            "id",
            "course",
            "course_slug",
            "number",
            "title",
            "title_kk",
            "summary",
            "summary_kk",
            "category",
            "content_language",
            "passing_percent",
            "max_attempts",
            "estimated_minutes",
            "lesson_count",
            "question_count",
            "published_at",
        ]
        read_only_fields = fields

    def get_lesson_count(self, instance) -> int:
        return len(instance.lessons)

    def get_question_count(self, instance) -> int:
        return len(instance.questions)


class CourseVersionAuthorSerializer(CourseVersionSummarySerializer):
    lessons = LessonSerializer(many=True, read_only=True)
    questions = AuthorQuestionSerializer(many=True, read_only=True)

    class Meta(CourseVersionSummarySerializer.Meta):
        fields = [
            *CourseVersionSummarySerializer.Meta.fields,
            "lessons",
            "questions",
            "published_by",
        ]
        read_only_fields = fields


class CatalogCourseSerializer(serializers.ModelSerializer):
    published_version = CourseVersionSummarySerializer(read_only=True)

    class Meta:
        model = Course
        fields = ["id", "slug", "availability", "published_version"]
        read_only_fields = fields


class AssignmentSerializer(StrictSerializer):
    employee = serializers.UUIDField()
    course_version = serializers.UUIDField()
    required = serializers.BooleanField(default=True)
    due_at = serializers.DateTimeField(allow_null=True, default=None)


class LessonCommandSerializer(VersionCommandSerializer):
    lesson_id = serializers.SlugField(max_length=80)


class AnswerSerializer(StrictSerializer):
    question_id = serializers.SlugField(max_length=80)
    selected_option_id = serializers.SlugField(max_length=40)


class AttemptCommandSerializer(VersionCommandSerializer):
    answers = AnswerSerializer(many=True, min_length=1, max_length=100)


class MaterialProgressSerializer(serializers.Serializer):
    completed_lesson_ids = serializers.ListField(child=serializers.CharField())
    required_total = serializers.IntegerField()
    required_completed = serializers.IntegerField()
    percent = serializers.IntegerField()


class AttemptSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizAttempt
        fields = [
            "id",
            "number",
            "correct_count",
            "question_count",
            "score",
            "passing_percent",
            "passed",
            "material_completed",
            "submitted_at",
        ]
        read_only_fields = fields


class AttemptDetailSerializer(AttemptSummarySerializer):
    answers = AnswerSerializer(many=True, read_only=True)

    class Meta(AttemptSummarySerializer.Meta):
        fields = [*AttemptSummarySerializer.Meta.fields, "answers"]
        read_only_fields = fields


class LessonCompletionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonCompletion
        fields = ["lesson_id", "completed_at"]
        read_only_fields = fields


class EnrollmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    course_version = CourseVersionSummarySerializer(read_only=True)
    availability = serializers.ChoiceField(
        source="course_version.course.availability",
        choices=Course.Availability.choices,
        read_only=True,
    )
    completion_state = serializers.SerializerMethodField()
    overdue = serializers.SerializerMethodField()
    material_progress = serializers.SerializerMethodField()
    last_attempt = serializers.SerializerMethodField()
    attempt_count = serializers.SerializerMethodField()
    remaining_attempts = serializers.SerializerMethodField()
    has_failed_attempt = serializers.SerializerMethodField()
    allowed_actions = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "employee",
            "employee_name",
            "course_version",
            "assigned_by",
            "required",
            "due_at",
            "started_at",
            "completed_at",
            "version",
            "availability",
            "completion_state",
            "overdue",
            "material_progress",
            "last_attempt",
            "attempt_count",
            "remaining_attempts",
            "has_failed_attempt",
            "allowed_actions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    @extend_schema_field(
        serializers.ChoiceField(choices=["not_started", "in_progress", "completed"])
    )
    def get_completion_state(self, instance):
        return enrollment_state(instance)

    def get_overdue(self, instance) -> bool:
        return bool(
            instance.due_at and instance.due_at < timezone.now() and not instance.completed_at
        )

    @extend_schema_field(MaterialProgressSerializer)
    def get_material_progress(self, instance):
        return material_progress(instance)

    @extend_schema_field(AttemptSummarySerializer(allow_null=True))
    def get_last_attempt(self, instance):
        attempts = list(instance.attempts.all())
        return AttemptSummarySerializer(attempts[-1]).data if attempts else None

    def get_attempt_count(self, instance) -> int:
        return len(instance.attempts.all())

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_remaining_attempts(self, instance):
        limit = instance.course_version.max_attempts
        return max(0, limit - len(instance.attempts.all())) if limit is not None else None

    def get_has_failed_attempt(self, instance) -> bool:
        return any(not attempt.passed for attempt in instance.attempts.all())

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_allowed_actions(self, instance):
        return enrollment_actions(self.context["request"].user, instance)


class EnrollmentDetailSerializer(EnrollmentSerializer):
    lesson_completions = LessonCompletionSerializer(many=True, read_only=True)
    attempts = AttemptSummarySerializer(many=True, read_only=True)

    class Meta(EnrollmentSerializer.Meta):
        fields = [*EnrollmentSerializer.Meta.fields, "lesson_completions", "attempts"]
        read_only_fields = fields


class LearningContentSerializer(CourseVersionSummarySerializer):
    lessons = LessonSerializer(many=True, read_only=True)
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta(CourseVersionSummarySerializer.Meta):
        fields = [*CourseVersionSummarySerializer.Meta.fields, "lessons", "questions"]
        read_only_fields = fields


class AttemptResultSerializer(serializers.Serializer):
    attempt = AttemptDetailSerializer()
    enrollment = EnrollmentDetailSerializer()


class EnrollmentSummarySerializer(serializers.Serializer):
    scope = serializers.CharField()
    computed_at = serializers.DateTimeField()
    total = serializers.IntegerField()
    completed = serializers.IntegerField()
    in_progress = serializers.IntegerField()
    not_started = serializers.IntegerField()
    overdue = serializers.IntegerField()
    required_outstanding = serializers.IntegerField()
    has_failed_attempt = serializers.IntegerField()
    due_next_seven_days = serializers.IntegerField()
    completion_percent = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
