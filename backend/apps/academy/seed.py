from datetime import timedelta
from uuid import NAMESPACE_URL, uuid5

from django.db import transaction
from django.utils import timezone

from apps.core.events import emit
from apps.core.models import DomainEvent
from apps.identity.models import Employee, LegalEntity, User

from . import services
from .curriculum import curriculum
from .models import Course, CourseVersion, Enrollment, QuizAttempt
from .selectors import enrollment_summary, visible_enrollments

SEED_REVISION = "academy-synthetic-v1"


def _answers(revision, *, correct):
    answers = []
    for question in revision.questions:
        choice = question["correct_option_id"]
        if not correct:
            choice = next(option["id"] for option in question["options"] if option["id"] != choice)
        answers.append({"question_id": question["id"], "selected_option_id": choice})
    return answers


def _material(employee, enrollment, count=None):
    lessons = enrollment.course_version.lessons
    for lesson in lessons if count is None else lessons[:count]:
        enrollment = services.complete_lesson(
            employee.user, enrollment.pk, enrollment.version, lesson["id"]
        )
    return enrollment


def _attempt(employee, enrollment, *, correct):
    _, enrollment = services.submit_attempt(
        employee.user,
        enrollment.pk,
        enrollment.version,
        _answers(enrollment.course_version, correct=correct),
    )
    return enrollment


def seed_manifest():
    dana = Employee.objects.filter(user__username="employee.demo").select_related("user").first()
    if dana is None:
        return {"seed_revision": SEED_REVISION, "initialized": False}
    codes = [item["slug"] for item in curriculum()]
    courses = Course.objects.filter(legal_entity=dana.legal_entity, slug__in=codes).select_related(
        "published_version"
    )
    revisions = [course.published_version for course in courses if course.published_version_id]
    enrollments = Enrollment.objects.filter(course_version__course__in=courses)
    own = visible_enrollments(dana.user).filter(employee=dana)
    lesson_words = {
        course.course.slug: sum(len(lesson["body_markdown"].split()) for lesson in course.lessons)
        for course in revisions
    }
    return {
        "seed_revision": SEED_REVISION,
        "initialized": courses.exists(),
        "synthetic": True,
        "catalogue_entity": str(dana.legal_entity_id),
        "course_count": courses.count(),
        "published_course_count": courses.filter(availability="published").count(),
        "archived_course_count": courses.filter(availability="archived").count(),
        "published_revision_count": CourseVersion.objects.filter(course__in=courses).count(),
        "lesson_count": sum(len(revision.lessons) for revision in revisions),
        "question_count": sum(len(revision.questions) for revision in revisions),
        "material_words_by_course": lesson_words,
        "material_words_total": sum(lesson_words.values()),
        "enrollment_count": enrollments.count(),
        "learner_count": enrollments.values("employee").distinct().count(),
        "quiz_attempt_count": QuizAttempt.objects.filter(enrollment__in=enrollments).count(),
        "demo_employee": {
            **enrollment_summary(own, scope="employee.demo"),
            "employee": str(dana.pk),
            "required": own.filter(required=True).count(),
            "recommended": own.filter(required=False).count(),
        },
        "content_language": "ru",
        "kazakh_translation": "titles_only; summaries_and_lessons_not_translated",
    }


@transaction.atomic
def seed_academy(employees):
    employees = list(employees.values()) if isinstance(employees, dict) else list(employees)
    by_username = {employee.user.username: employee for employee in employees}
    dana = by_username.get("employee.demo")
    hr = by_username.get("hr.demo")
    if dana is None or hr is None:
        raise ValueError(
            "Academy seed requires the canonical synthetic employee.demo and hr.demo accounts."
        )
    LegalEntity.objects.select_for_update().get(pk=dana.legal_entity_id)
    marker_id = uuid5(NAMESPACE_URL, f"janamen/{SEED_REVISION}/{dana.legal_entity_id}")
    if DomainEvent.objects.filter(
        event_type="academy.seed_initialized", aggregate_id=marker_id
    ).exists():
        return {
            **seed_manifest(),
            "created_courses": 0,
            "created_enrollments": 0,
            "preserved_existing": True,
        }
    courses = []
    created_courses = 0
    for item in curriculum():
        course = Course.objects.filter(slug=item["slug"]).first()
        if course is None:
            course = services.create_course(hr.user, item["slug"], item["draft"])
            course = services.publish_course(hr.user, course.pk, course.version)
            created_courses += 1
        if (
            course.legal_entity_id != dana.legal_entity_id
            or course.published_version_id is None
            or course.availability != "published"
        ):
            raise ValueError(
                f"Existing course {item['slug']} conflicts with the initial fixture. Existing data was preserved."
            )
        courses.append(course)
    created_enrollments = 0
    now = timezone.now()

    def assign(employee, index, required, due):
        nonlocal created_enrollments
        course = courses[index]
        existing = Enrollment.objects.filter(
            employee=employee, course_version=course.published_version
        ).first()
        if existing:
            return existing, False
        enrollment = services.assign(
            hr.user, course.published_version_id, employee.pk, required=required, due_at=due
        )
        created_enrollments += 1
        return enrollment, True

    for index in range(24):
        if index in {8, 9, 14, 15, 16}:
            due = now - timedelta(days=1 + index % 4)
        elif index in {10, 11, 17, 18}:
            due = now + timedelta(days=2 + index % 4)
        else:
            due = now + timedelta(days=15 + index)
        enrollment, created = assign(dana, index, index < 18, due)
        if not created:
            continue
        if index < 8:
            enrollment = _material(dana, enrollment)
            if index in {0, 2, 4}:
                enrollment = _attempt(dana, enrollment, correct=False)
            _attempt(dana, enrollment, correct=True)
        elif index in {8, 9}:
            enrollment = _material(dana, enrollment)
            _attempt(dana, enrollment, correct=False)
        elif index == 10:
            services.start(dana.user, enrollment.pk, enrollment.version)
        elif index in {11, 13}:
            _material(dana, enrollment, count=1)
        elif index == 12:
            _material(dana, enrollment)

    local_staff = sorted(
        (
            employee
            for employee in employees
            if employee.legal_entity_id == dana.legal_entity_id and employee.pk != dana.pk
        ),
        key=lambda employee: employee.user.username,
    )
    for staff_index, employee in enumerate(local_staff):
        if employee.user.username == "new.demo":
            indices = [0, 1, 18]
        elif employee.user.role == User.Role.HR:
            indices = [20, 25, 26, 27, 28, 29]
        elif employee.user.role == User.Role.MANAGER:
            indices = [1, 20, 21, 22, 23, 24]
        else:
            indices = {
                "warehouse": [5, 6, 7, 8, 9, 17],
                "pvz": [5, 7, 10, 11, 12, 18],
                "support": [10, 11, 12, 13, 14, 29],
            }[employee.department.code]
        for position, course_index in enumerate(indices):
            state = (staff_index + position) % 4
            due = now + timedelta(days=position + 8) if state != 2 else now - timedelta(days=2)
            enrollment, created = assign(employee, course_index, position < 4, due)
            if not created or employee.user.username == "new.demo":
                continue
            if state == 0:
                enrollment = _material(employee, enrollment)
                _attempt(employee, enrollment, correct=True)
            elif state == 1:
                _material(employee, enrollment, count=1)
            elif state == 2:
                enrollment = _material(employee, enrollment)
                _attempt(employee, enrollment, correct=False)
    emit(
        "academy.seed_initialized",
        "academy_seed",
        marker_id,
        {"seed_revision": SEED_REVISION},
        actor=hr.user,
    )
    return {
        **seed_manifest(),
        "created_courses": created_courses,
        "created_enrollments": created_enrollments,
        "preserved_existing": False,
    }
