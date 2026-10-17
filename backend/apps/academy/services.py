from copy import deepcopy
from decimal import ROUND_HALF_UP, Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.core.errors import Conflict
from apps.core.events import emit
from apps.identity.models import Employee, LegalEntity
from apps.identity.permissions import require_hr
from apps.identity.selectors import employee_for, visible_employees
from apps.notifications.services import notify

from .content import validate_draft
from .models import Course, CourseVersion, Enrollment, LessonCompletion, QuizAttempt
from .selectors import visible_courses, visible_enrollments


def _check_version(instance, expected_version):
    if instance.version != expected_version:
        raise Conflict("The learning record changed. Reload its current version before continuing.")


def author_course(user, course_id, *, lock=False):
    require_hr(user)
    queryset = visible_courses(user)
    if lock:
        queryset = queryset.select_for_update(of=("self",))
    course = queryset.filter(pk=course_id).first()
    if course is None:
        raise NotFound()
    require_hr(user, course.legal_entity_id)
    return course


@transaction.atomic
def create_course(user, slug, draft, legal_entity=None):
    require_hr(user, legal_entity)
    owner = employee_for(user)
    entity_id = legal_entity or (owner.legal_entity_id if owner else None)
    entity = LegalEntity.objects.filter(pk=entity_id).first()
    if entity is None:
        raise ValidationError(
            {"legal_entity": "Choose an existing legal entity within your scope."}
        )
    if Course.objects.filter(slug=slug).exists():
        raise Conflict("This course code is already used. Choose another code.")
    validated = validate_draft(draft)
    try:
        with transaction.atomic():
            course = Course.objects.create(
                slug=slug, legal_entity=entity, owner=user, draft=validated
            )
    except IntegrityError as error:
        if Course.objects.filter(slug=slug).exists():
            raise Conflict("This course code is already used. Choose another code.") from error
        raise
    emit("academy.course_created", "course", course.pk, {"slug": course.slug}, actor=user)
    return course


@transaction.atomic
def save_draft(user, course_id, expected_version, draft):
    course = author_course(user, course_id, lock=True)
    _check_version(course, expected_version)
    course.draft = validate_draft(draft)
    course.version += 1
    course.save(update_fields=["draft", "version", "updated_at"])
    emit("academy.draft_saved", "course", course.pk, {"version": course.version}, actor=user)
    return course


@transaction.atomic
def publish_course(user, course_id, expected_version):
    course = author_course(user, course_id, lock=True)
    _check_version(course, expected_version)
    draft = validate_draft(course.draft, publishing=True)
    if course.published_version:
        old = course.published_version
        if all(getattr(old, field) == value for field, value in draft.items()):
            raise Conflict(
                "This draft is already published. Edit the draft or restore its availability."
            )
    number = course.revisions.count() + 1
    revision = CourseVersion.objects.create(
        course=course, number=number, published_by=user, **deepcopy(draft)
    )
    course.published_version = revision
    course.availability = Course.Availability.PUBLISHED
    course.version += 1
    course.save(update_fields=["published_version", "availability", "version", "updated_at"])
    emit(
        "academy.course_published",
        "course",
        course.pk,
        {"course_version": str(revision.pk), "number": number},
        actor=user,
    )
    return course


@transaction.atomic
def set_availability(user, course_id, expected_version, availability):
    course = author_course(user, course_id, lock=True)
    _check_version(course, expected_version)
    if course.published_version_id is None:
        raise Conflict("Publish a course before changing its availability.")
    if availability not in {Course.Availability.ARCHIVED, Course.Availability.PUBLISHED}:
        raise ValidationError({"availability": "Choose published or archived."})
    if course.availability != availability:
        course.availability = availability
        course.version += 1
        course.save(update_fields=["availability", "version", "updated_at"])
        emit(
            "academy.availability_changed",
            "course",
            course.pk,
            {"availability": availability, "version": course.version},
            actor=user,
        )
    return course


def assignment_scope(user, course_version_id, employee_id):
    require_hr(user)
    employee = (
        visible_employees(user).filter(pk=employee_id, is_active=True, user__is_active=True).first()
    )
    revision = (
        CourseVersion.objects.filter(pk=course_version_id, course__in=visible_courses(user))
        .select_related("course")
        .first()
    )
    if employee is None or revision is None:
        raise NotFound()
    require_hr(user, employee.legal_entity_id)
    if employee.legal_entity_id != revision.course.legal_entity_id:
        raise PermissionDenied("Course and employee must belong to the same legal entity.")
    return employee, revision


@transaction.atomic
def assign(user, course_version, employee, required=True, due_at=None):
    target, revision = assignment_scope(user, course_version, employee)
    course = Course.objects.select_for_update().get(pk=revision.course_id)
    if course.availability != Course.Availability.PUBLISHED:
        raise Conflict("The course is unavailable. Choose a published course.")
    if course.published_version_id != revision.pk:
        raise Conflict(
            "A newer course revision is available. Refresh the course before assigning it."
        )
    target = Employee.objects.select_for_update().get(pk=target.pk)
    if Enrollment.objects.filter(employee=target, course_version=revision).exists():
        raise Conflict("This employee already has an enrollment for this course revision.")
    enrollment = Enrollment.objects.create(
        employee=target,
        course_version=revision,
        assigned_by=user,
        required=required,
        due_at=due_at,
    )
    event = emit(
        "academy.course_assigned",
        "enrollment",
        enrollment.pk,
        {"employee": str(target.pk), "course_version": str(revision.pk), "required": required},
        actor=user,
    )
    notify(
        target.user,
        "course_assigned",
        "Вам назначен курс",
        revision.title,
        "enrollment",
        enrollment.pk,
        event=event,
    )
    return enrollment


def owned_enrollment(user, enrollment_id, *, lock=False):
    queryset = visible_enrollments(user)
    if lock:
        queryset = queryset.select_for_update(of=("self",))
    enrollment = queryset.filter(pk=enrollment_id).first()
    if enrollment is None:
        raise NotFound()
    if enrollment.employee.user_id != user.pk or not enrollment.employee.is_active:
        raise PermissionDenied("Only the enrolled employee can record learning progress.")
    return enrollment


def _progress_command(user, enrollment_id, expected_version):
    enrollment = owned_enrollment(user, enrollment_id, lock=True)
    _check_version(enrollment, expected_version)
    if enrollment.course_version.course.availability != Course.Availability.PUBLISHED:
        raise Conflict(
            "This course is archived. Your results remain available; ask HR about learning access."
        )
    if enrollment.completed_at:
        raise Conflict("This enrollment is already completed. Its recorded result is preserved.")
    return enrollment


def _save_progress(enrollment, user, event_type, payload, *, now):
    if enrollment.started_at is None:
        enrollment.started_at = now
    enrollment.version += 1
    enrollment.save(update_fields=["started_at", "completed_at", "version", "updated_at"])
    return emit(event_type, "enrollment", enrollment.pk, payload, actor=user)


@transaction.atomic
def start(user, enrollment_id, expected_version, *, at=None):
    enrollment = _progress_command(user, enrollment_id, expected_version)
    if enrollment.started_at is None:
        _save_progress(enrollment, user, "academy.learning_started", {}, now=at or timezone.now())
    return enrollment


@transaction.atomic
def complete_lesson(user, enrollment_id, expected_version, lesson_id, *, at=None):
    enrollment = _progress_command(user, enrollment_id, expected_version)
    if lesson_id not in {lesson["id"] for lesson in enrollment.course_version.lessons}:
        raise ValidationError(
            {"lesson_id": "Choose a lesson from this enrollment's course revision."}
        )
    now = at or timezone.now()
    _, created = LessonCompletion.objects.get_or_create(
        enrollment=enrollment, lesson_id=lesson_id, defaults={"completed_at": now}
    )
    if created:
        _save_progress(
            enrollment, user, "academy.lesson_completed", {"lesson_id": lesson_id}, now=now
        )
    enrollment._prefetched_objects_cache = {}
    return enrollment


@transaction.atomic
def submit_attempt(user, enrollment_id, expected_version, answers, *, at=None):
    enrollment = _progress_command(user, enrollment_id, expected_version)
    revision = enrollment.course_version
    completed = set(enrollment.lesson_completions.values_list("lesson_id", flat=True))
    required = {lesson["id"] for lesson in revision.lessons if lesson["required"]}
    if not required.issubset(completed):
        raise Conflict("Complete every required lesson before submitting the assessment.")
    count = enrollment.attempts.count()
    if revision.max_attempts is not None and count >= revision.max_attempts:
        raise Conflict("The published attempt limit is reached. Ask HR about further learning.")
    given = {answer["question_id"]: answer["selected_option_id"] for answer in answers}
    questions = {question["id"]: question for question in revision.questions}
    if len(given) != len(answers) or given.keys() != questions.keys():
        raise ValidationError(
            {"answers": "Answer each question exactly once using this course revision."}
        )
    for question_id, choice in given.items():
        if choice not in {option["id"] for option in questions[question_id]["options"]}:
            raise ValidationError({"answers": "Each selected option must belong to its question."})
    correct = sum(
        given[key] == question["correct_option_id"] for key, question in questions.items()
    )
    passed = correct * 100 >= len(questions) * revision.passing_percent
    now = at or timezone.now()
    attempt = QuizAttempt.objects.create(
        enrollment=enrollment,
        number=count + 1,
        question_snapshot=deepcopy(revision.questions),
        answers=deepcopy(answers),
        correct_count=correct,
        question_count=len(questions),
        score=(Decimal(correct * 100) / len(questions)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        ),
        passing_percent=revision.passing_percent,
        passed=passed,
        material_completed=True,
        submitted_at=now,
    )
    if passed:
        enrollment.completed_at = now
    event = _save_progress(
        enrollment,
        user,
        "academy.course_completed" if passed else "academy.quiz_failed",
        {"attempt": str(attempt.pk), "passed": passed, "score": str(attempt.score)},
        now=now,
    )
    if passed:
        notify(
            user,
            "course_completed",
            "Курс завершён",
            revision.title,
            "enrollment",
            enrollment.pk,
            event=event,
        )
    enrollment._prefetched_objects_cache = {}
    return attempt, enrollment
