from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models import AppendOnlyModel, TimestampedModel


class Course(TimestampedModel):
    class Availability(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    slug = models.SlugField(max_length=80, unique=True)
    legal_entity = models.ForeignKey("identity.LegalEntity", on_delete=models.PROTECT)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    draft = models.JSONField(default=dict)
    availability = models.CharField(max_length=16, choices=Availability, default=Availability.DRAFT)
    version = models.PositiveIntegerField(default=1)
    published_version = models.ForeignKey(
        "CourseVersion", on_delete=models.PROTECT, null=True, related_name="current_for"
    )

    class Meta:
        ordering = ["slug", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(version__gte=1), name="course_version_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(availability="draft", published_version__isnull=True)
                | models.Q(
                    availability__in=["published", "archived"], published_version__isnull=False
                ),
                name="course_publication_valid",
            ),
        ]
        indexes = [models.Index(fields=["legal_entity", "availability"])]


class CourseVersion(AppendOnlyModel):
    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name="revisions")
    number = models.PositiveIntegerField()
    title = models.CharField(max_length=200)
    title_kk = models.CharField(max_length=200, blank=True)
    summary = models.TextField(max_length=2000)
    summary_kk = models.TextField(max_length=2000, blank=True)
    category = models.CharField(max_length=32)
    content_language = models.CharField(
        max_length=8, choices=[("ru", "Русский"), ("kk", "Қазақша")]
    )
    lessons = models.JSONField()
    questions = models.JSONField()
    passing_percent = models.PositiveSmallIntegerField()
    max_attempts = models.PositiveSmallIntegerField(null=True)
    estimated_minutes = models.PositiveSmallIntegerField(null=True)
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    published_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["course_id", "number"]
        constraints = [
            models.UniqueConstraint(fields=["course", "number"], name="course_revision_unique"),
            models.CheckConstraint(
                condition=models.Q(number__gte=1), name="course_revision_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(passing_percent__gte=1, passing_percent__lte=100),
                name="course_passing_percent_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(max_attempts__isnull=True) | models.Q(max_attempts__gte=1),
                name="course_max_attempts_valid",
            ),
        ]


class Enrollment(TimestampedModel):
    employee = models.ForeignKey(
        "identity.Employee", on_delete=models.PROTECT, related_name="enrollments"
    )
    course_version = models.ForeignKey(
        CourseVersion, on_delete=models.PROTECT, related_name="enrollments"
    )
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    required = models.BooleanField(default=True)
    due_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["-created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "course_version"], name="enrollment_employee_revision_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(version__gte=1), name="enrollment_version_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(completed_at__isnull=True)
                | models.Q(started_at__isnull=False, completed_at__gte=models.F("started_at")),
                name="enrollment_completion_follows_start",
            ),
        ]
        indexes = [models.Index(fields=["employee", "completed_at", "due_at"])]


class LessonCompletion(AppendOnlyModel):
    enrollment = models.ForeignKey(
        Enrollment, on_delete=models.PROTECT, related_name="lesson_completions"
    )
    lesson_id = models.CharField(max_length=80)
    completed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["completed_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["enrollment", "lesson_id"], name="lesson_completion_unique"
            )
        ]


class QuizAttempt(AppendOnlyModel):
    enrollment = models.ForeignKey(Enrollment, on_delete=models.PROTECT, related_name="attempts")
    number = models.PositiveIntegerField()
    question_snapshot = models.JSONField()
    answers = models.JSONField()
    correct_count = models.PositiveSmallIntegerField()
    question_count = models.PositiveSmallIntegerField()
    score = models.DecimalField(max_digits=5, decimal_places=2)
    passing_percent = models.PositiveSmallIntegerField()
    passed = models.BooleanField()
    material_completed = models.BooleanField()
    submitted_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["number", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["enrollment", "number"], name="quiz_attempt_number_unique"
            ),
            models.CheckConstraint(
                condition=models.Q(number__gte=1), name="quiz_attempt_number_positive"
            ),
            models.CheckConstraint(
                condition=models.Q(question_count__gt=0, correct_count__gte=0)
                & models.Q(correct_count__lte=models.F("question_count")),
                name="quiz_attempt_counts_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(score__gte=0, score__lte=100), name="quiz_score_valid"
            ),
            models.CheckConstraint(
                condition=models.Q(passed=False) | models.Q(material_completed=True),
                name="quiz_success_requires_material",
            ),
        ]
