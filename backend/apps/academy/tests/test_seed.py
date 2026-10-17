from copy import deepcopy

import pytest

from apps.academy import services
from apps.academy.curriculum import curriculum
from apps.academy.models import Course, Enrollment, QuizAttempt
from apps.academy.seed import seed_academy
from apps.core.models import DomainEvent
from apps.identity.seed import seed_identity
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db


def test_curriculum_contains_distinct_substantive_material_and_matching_questions():
    courses = curriculum()
    assert len(courses) == 30
    assert {item["code"] for item in courses} == {
        f"{prefix}-{index:02}"
        for prefix in ["HR", "LG", "CX", "IS", "TM", "KB"]
        for index in range(1, 6)
    }
    assert len({item["draft"]["title"] for item in courses}) == 30
    texts = set()
    prompts = set()
    for item in courses:
        draft = item["draft"]
        assert len(draft["lessons"]) >= 2
        assert len(draft["questions"]) >= 3
        word_count = sum(len(lesson["body_markdown"].split()) for lesson in draft["lessons"])
        assert 350 <= word_count <= 700, (item["code"], word_count)
        assert draft["title_kk"]
        for lesson in draft["lessons"]:
            assert lesson["body_markdown"] not in texts
            texts.add(lesson["body_markdown"])
            assert "синтетические" in lesson["body_markdown"]
        for question in draft["questions"]:
            assert question["prompt"] not in prompts
            prompts.add(question["prompt"])
            assert question["correct_option_id"] in {option["id"] for option in question["options"]}
            assert question["explanation"]


def test_seed_creates_full_catalogue_and_canonical_independent_states(api_client):
    employees = seed_identity("Synthetic-academy-password-87!")
    report = seed_academy(employees)
    assert report["created_courses"] == report["course_count"] == 30
    assert report["published_course_count"] == 30
    assert report["lesson_count"] == 60
    assert report["question_count"] == 90
    assert report["created_enrollments"] == report["enrollment_count"] == 189
    assert report["learner_count"] == 29
    dana = next(employee for employee in employees if employee.user.username == "employee.demo")
    api_client.force_authenticate(dana.user)
    summary = api_client.get("/api/v1/academy/enrollments/summary/").data
    assert summary["total"] == 24
    assert summary["completed"] == 8
    assert summary["in_progress"] == 6
    assert summary["not_started"] == 10
    assert summary["overdue"] == 5
    assert summary["due_next_seven_days"] == 4
    assert summary["has_failed_attempt"] == 5
    assert summary["completion_percent"] == "33.33"
    assert Enrollment.objects.filter(employee=dana, required=True).count() == 18
    assert Enrollment.objects.filter(employee=dana, required=False).count() == 6
    assert QuizAttempt.objects.filter(enrollment__employee=dana).count() == 13
    completed_with_failure = Enrollment.objects.filter(
        employee=dana, completed_at__isnull=False, attempts__passed=False
    ).distinct()
    assert completed_with_failure.count() == 3
    newcomer = next(employee for employee in employees if employee.user.username == "new.demo")
    assert Enrollment.objects.filter(employee=newcomer).count() == 3
    assert not Enrollment.objects.filter(employee=newcomer, started_at__isnull=False).exists()
    assert api_client.get("/api/v1/academy/courses/?page_size=30").data["count"] == 30


def test_seed_repetition_preserves_live_draft_learning_and_notifications():
    employees = seed_identity("Synthetic-academy-password-87!")
    seed_academy(employees)
    dana = next(employee for employee in employees if employee.user.username == "employee.demo")
    hr = next(employee for employee in employees if employee.user.username == "hr.demo")
    course = Course.objects.get(slug="hr-01")
    draft = deepcopy(course.draft)
    draft["title"] = "Изменённый после seed черновик"
    course = services.save_draft(hr.user, course.pk, course.version, draft)
    fresh = Enrollment.objects.filter(employee=dana, started_at__isnull=True).first()
    services.start(dana.user, fresh.pk, fresh.version)
    before = (
        DomainEvent.objects.count(),
        Notification.objects.count(),
        QuizAttempt.objects.count(),
    )
    report = seed_academy(employees)
    assert report["created_courses"] == report["created_enrollments"] == 0
    assert report["preserved_existing"] is True
    course.refresh_from_db()
    assert course.draft["title"] == draft["title"]
    fresh.refresh_from_db()
    assert fresh.started_at is not None
    assert before == (
        DomainEvent.objects.count(),
        Notification.objects.count(),
        QuizAttempt.objects.count(),
    )
