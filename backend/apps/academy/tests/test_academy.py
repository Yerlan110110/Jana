from copy import deepcopy
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone

from apps.academy import services
from apps.academy.models import Course, CourseVersion, Enrollment, LessonCompletion, QuizAttempt
from apps.core.models import DomainEvent
from apps.notifications.models import Notification

from .conftest import answer_payload, finish_material

pytestmark = pytest.mark.django_db


def post(client, url, values, key="command-1"):
    return client.post(url, values, HTTP_IDEMPOTENCY_KEY=key)


def assert_no_keys(value):
    if isinstance(value, dict):
        assert not {"correct_option_id", "question_snapshot", "explanation"}.intersection(value)
        for child in value.values():
            assert_no_keys(child)
    elif isinstance(value, list):
        for child in value:
            assert_no_keys(child)


def test_catalog_has_only_published_scoped_metadata(
    api_client, employees, published_course, course_draft
):
    services.create_course(employees["hr"].user, "unpublished", course_draft)
    api_client.force_authenticate(employees["employee"].user)
    response = api_client.get("/api/v1/academy/courses/?category=hr&search=сведений")
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == str(published_course.pk)
    assert "questions" not in response.data["results"][0]["published_version"]
    assert "lessons" not in response.data["results"][0]["published_version"]
    assert_no_keys(response.data)
    api_client.force_authenticate(employees["other_entity"].user)
    assert api_client.get("/api/v1/academy/courses/").data["count"] == 0
    assert api_client.get(f"/api/v1/academy/courses/{published_course.pk}/").status_code == 404


def test_authoring_is_hr_only_and_replay_rechecks_current_role(api_client, employees, course_draft):
    api_client.force_authenticate(employees["employee"].user)
    assert api_client.get("/api/v1/academy/manage/courses/").status_code == 403
    values = {"slug": "new-course", "draft": course_draft}
    assert post(api_client, "/api/v1/academy/manage/courses/", values).status_code == 403
    hr = employees["hr"].user
    api_client.force_authenticate(hr)
    first = post(api_client, "/api/v1/academy/manage/courses/", values)
    assert first.status_code == 201
    hr.role = "employee"
    hr.save()
    assert post(api_client, "/api/v1/academy/manage/courses/", values).status_code == 403
    assert Course.objects.filter(slug="new-course").count() == 1


def test_hr_cannot_author_foreign_entity(api_client, employees, course_draft):
    api_client.force_authenticate(employees["hr"].user)
    values = {
        "slug": "cross-tenant",
        "draft": course_draft,
        "legal_entity": str(employees["other_entity"].legal_entity_id),
    }
    assert post(api_client, "/api/v1/academy/manage/courses/", values).status_code == 403
    assert not Course.objects.filter(slug="cross-tenant").exists()


def test_draft_validation_and_publish_require_complete_content(api_client, employees, course_draft):
    api_client.force_authenticate(employees["hr"].user)
    draft = deepcopy(course_draft)
    draft["lessons"] = []
    draft["questions"] = []
    response = post(
        api_client, "/api/v1/academy/manage/courses/", {"slug": "draft-only", "draft": draft}
    )
    assert response.status_code == 201
    course_id = response.data["id"]
    response = post(
        api_client,
        f"/api/v1/academy/manage/courses/{course_id}/publish/",
        {"expected_version": 1},
        "publish",
    )
    assert response.status_code == 400
    assert CourseVersion.objects.count() == 0
    invalid = deepcopy(course_draft)
    invalid["questions"][0]["correct_option_id"] = "unknown"
    response = post(
        api_client,
        f"/api/v1/academy/manage/courses/{course_id}/save-draft/",
        {"expected_version": 1, "draft": invalid},
        "invalid-draft",
    )
    assert response.status_code == 400
    assert Course.objects.get(pk=course_id).version == 1


def test_assignments_scoped_retried_without_duplicates(api_client, employees, published_course):
    values = {
        "employee": str(employees["employee"].pk),
        "course_version": str(published_course.published_version_id),
    }
    api_client.force_authenticate(employees["manager"].user)
    assert post(api_client, "/api/v1/academy/enrollments/", values).status_code == 403
    api_client.force_authenticate(employees["hr"].user)
    first = post(api_client, "/api/v1/academy/enrollments/", values)
    assert first.status_code == 201
    second = post(api_client, "/api/v1/academy/enrollments/", values)
    assert second.status_code == 201
    assert second.data == first.data
    assert second["Idempotency-Replayed"] == "true"
    assert Enrollment.objects.count() == 1
    assert Notification.objects.filter(kind="course_assigned").count() == 1
    assert (
        post(api_client, "/api/v1/academy/enrollments/", values, "distinct-command").status_code
        == 409
    )
    values["employee"] = str(employees["other_entity"].pk)
    assert post(api_client, "/api/v1/academy/enrollments/", values, "outside").status_code == 404


def test_scope_applies_to_lists_details_and_progress(
    api_client, employees, enrollment, published_course
):
    other = services.assign(
        employees["hr"].user, published_course.published_version_id, employees["other_team"].pk
    )
    api_client.force_authenticate(employees["manager"].user)
    result = api_client.get("/api/v1/academy/enrollments/")
    assert result.data["count"] == 1
    assert api_client.get(f"/api/v1/academy/enrollments/{enrollment.pk}/").status_code == 200
    assert api_client.get(f"/api/v1/academy/enrollments/{other.pk}/").status_code == 404
    assert (
        post(
            api_client,
            f"/api/v1/academy/enrollments/{enrollment.pk}/start/",
            {"expected_version": 1},
        ).status_code
        == 403
    )
    assert (
        api_client.get(f"/api/v1/academy/enrollments/{enrollment.pk}/learning/").status_code == 403
    )
    api_client.force_authenticate(employees["other_entity"].user)
    assert api_client.get("/api/v1/academy/enrollments/").data["count"] == 0
    assert (
        post(
            api_client,
            f"/api/v1/academy/enrollments/{enrollment.pk}/start/",
            {"expected_version": 1},
        ).status_code
        == 404
    )


def test_learner_reads_key_free_published_revision_only(api_client, employees, enrollment):
    api_client.force_authenticate(employees["employee"].user)
    response = api_client.get(f"/api/v1/academy/enrollments/{enrollment.pk}/learning/")
    assert response.status_code == 200
    assert len(response.data["questions"]) == 3
    assert len(response.data["lessons"]) == 2
    assert_no_keys(response.data)
    assert (
        api_client.get(
            f"/api/v1/academy/manage/courses/{enrollment.course_version.course_id}/"
        ).status_code
        == 403
    )


def test_scoring_requires_material_and_rejects_forged_fields(api_client, employees, enrollment):
    api_client.force_authenticate(employees["employee"].user)
    url = f"/api/v1/academy/enrollments/{enrollment.pk}/submit-attempt/"
    values = {"expected_version": 1, "answers": answer_payload()}
    assert post(api_client, url, values).status_code == 409
    assert QuizAttempt.objects.count() == 0
    values["score"] = "100.00"
    assert post(api_client, url, values).status_code == 400
    lesson_url = f"/api/v1/academy/enrollments/{enrollment.pk}/complete-lesson/"
    assert (
        post(api_client, lesson_url, {"expected_version": 1, "lesson_id": "foreign"}).status_code
        == 400
    )
    assert LessonCompletion.objects.count() == 0
    assert (
        api_client.patch(
            f"/api/v1/academy/enrollments/{enrollment.pk}/",
            {"completed_at": timezone.now().isoformat()},
        ).status_code
        == 405
    )


def test_lesson_completion_is_idempotent_and_stale_writes_conflict(
    api_client, employees, enrollment
):
    api_client.force_authenticate(employees["employee"].user)
    url = f"/api/v1/academy/enrollments/{enrollment.pk}/complete-lesson/"
    values = {"expected_version": 1, "lesson_id": "source"}
    first = post(api_client, url, values)
    assert first.status_code == 200
    assert first.data["material_progress"]["percent"] == 50
    assert first.data["completion_state"] == "in_progress"
    assert first.data["completed_at"] is None
    assert post(api_client, url, values).data == first.data
    assert post(api_client, url, values, "stale").status_code == 409
    current = {"expected_version": first.data["version"], "lesson_id": "source"}
    assert post(api_client, url, current, "repeat-existing").status_code == 200
    assert LessonCompletion.objects.count() == 1
    assert DomainEvent.objects.filter(event_type="academy.lesson_completed").count() == 1


def test_failed_attempt_preserves_progress_then_success_records_result(
    api_client, employees, enrollment
):
    enrollment = finish_material(employees["employee"], enrollment)
    api_client.force_authenticate(employees["employee"].user)
    url = f"/api/v1/academy/enrollments/{enrollment.pk}/submit-attempt/"
    failure = post(
        api_client,
        url,
        {"expected_version": enrollment.version, "answers": answer_payload(correct=False)},
        "failure",
    )
    assert failure.status_code == 201
    assert failure.data["attempt"]["score"] == "0.00"
    assert failure.data["attempt"]["passed"] is False
    assert failure.data["enrollment"]["material_progress"]["percent"] == 100
    assert failure.data["enrollment"]["completion_state"] == "in_progress"
    values = {
        "expected_version": failure.data["enrollment"]["version"],
        "answers": answer_payload(),
    }
    success = post(api_client, url, values, "success")
    assert success.status_code == 201
    assert success.data["attempt"]["score"] == "100.00"
    assert success.data["enrollment"]["completion_state"] == "completed"
    assert success.data["enrollment"]["has_failed_attempt"] is True
    assert success.data["enrollment"]["allowed_actions"] == []
    assert post(api_client, url, values, "success").data == success.data
    assert QuizAttempt.objects.count() == 2
    assert Notification.objects.filter(kind="course_completed").count() == 1
    assert_no_keys(success.data)
    assert_no_keys(api_client.get(f"/api/v1/academy/enrollments/{enrollment.pk}/attempts/").data)


def test_question_sets_options_and_attempt_limit_are_server_rules(
    api_client, employees, enrollment
):
    enrollment = finish_material(employees["employee"], enrollment)
    api_client.force_authenticate(employees["employee"].user)
    url = f"/api/v1/academy/enrollments/{enrollment.pk}/submit-attempt/"
    for index, answers in enumerate(
        [
            answer_payload()[:2],
            [answer_payload()[0]] * 3,
            [{"question_id": "q1", "selected_option_id": "unknown"}, *answer_payload()[1:]],
        ]
    ):
        assert (
            post(
                api_client,
                url,
                {"expected_version": enrollment.version, "answers": answers},
                f"invalid-{index}",
            ).status_code
            == 400
        )
    for number in range(3):
        result = post(
            api_client,
            url,
            {"expected_version": enrollment.version, "answers": answer_payload(correct=False)},
            f"attempt-{number}",
        )
        assert result.status_code == 201
        enrollment.refresh_from_db()
    final = post(
        api_client,
        url,
        {"expected_version": enrollment.version, "answers": answer_payload()},
        "fourth",
    )
    assert final.status_code == 409
    assert QuizAttempt.objects.count() == 3
    detail = api_client.get(f"/api/v1/academy/enrollments/{enrollment.pk}/").data
    assert detail["remaining_attempts"] == 0
    assert "submit_attempt" not in detail["allowed_actions"]
    assert detail["material_progress"]["percent"] == 100


def test_archival_and_new_revision_preserve_learning_history(
    api_client, employees, enrollment, published_course, course_draft
):
    enrollment = finish_material(employees["employee"], enrollment)
    first_attempt, enrollment = services.submit_attempt(
        employees["employee"].user, enrollment.pk, enrollment.version, answer_payload()
    )
    original_revision = enrollment.course_version_id
    changed = deepcopy(course_draft)
    changed["title"] = "Новое название"
    changed["questions"][0]["correct_option_id"] = "b"
    course = services.save_draft(
        employees["hr"].user, published_course.pk, published_course.version, changed
    )
    course = services.publish_course(employees["hr"].user, course.pk, course.version)
    course = services.set_availability(employees["hr"].user, course.pk, course.version, "archived")
    api_client.force_authenticate(employees["employee"].user)
    detail = api_client.get(f"/api/v1/academy/enrollments/{enrollment.pk}/").data
    assert detail["availability"] == "archived"
    assert detail["completion_state"] == "completed"
    assert detail["course_version"]["id"] == str(original_revision)
    assert detail["course_version"]["title"] == course_draft["title"]
    assert api_client.get("/api/v1/academy/courses/").data["count"] == 0
    first_attempt.refresh_from_db()
    assert first_attempt.question_snapshot[0]["correct_option_id"] == "a"
    assert first_attempt.passed is True
    with pytest.raises(DjangoValidationError):
        first_attempt.save()
    with pytest.raises(DjangoValidationError):
        CourseVersion.objects.filter(pk=original_revision).update(title="overwrite")
    services.set_availability(employees["hr"].user, course.pk, course.version, "published")
    assert api_client.get("/api/v1/academy/courses/").data["count"] == 1


def test_archive_disables_new_progress_without_erasing_saved_progress(
    api_client, employees, enrollment, published_course
):
    enrollment = services.complete_lesson(
        employees["employee"].user, enrollment.pk, enrollment.version, "source"
    )
    services.set_availability(
        employees["hr"].user, published_course.pk, published_course.version, "archived"
    )
    api_client.force_authenticate(employees["employee"].user)
    result = post(
        api_client,
        f"/api/v1/academy/enrollments/{enrollment.pk}/complete-lesson/",
        {"expected_version": enrollment.version, "lesson_id": "history"},
    )
    assert result.status_code == 409
    detail = api_client.get(f"/api/v1/academy/enrollments/{enrollment.pk}/").data
    assert detail["material_progress"]["percent"] == 50
    assert detail["allowed_actions"] == []
    assert (
        api_client.get(f"/api/v1/academy/enrollments/{enrollment.pk}/learning/").status_code == 200
    )


def test_completion_notification_failure_rolls_back_result(employees, enrollment):
    enrollment = finish_material(employees["employee"], enrollment)
    before_events = DomainEvent.objects.count()
    with patch(
        "apps.academy.services.notify", side_effect=RuntimeError("Synthetic delivery fault")
    ):
        with pytest.raises(RuntimeError):
            services.submit_attempt(
                employees["employee"].user, enrollment.pk, enrollment.version, answer_payload()
            )
    enrollment.refresh_from_db()
    assert enrollment.completed_at is None
    assert QuizAttempt.objects.count() == 0
    assert DomainEvent.objects.count() == before_events
    assert enrollment.lesson_completions.count() == 2


def test_summary_filter_denominator_and_overdue_are_independent(
    api_client, employees, enrollment, published_course
):
    enrollment.due_at = timezone.now() - timedelta(days=2)
    enrollment.save()
    peer = services.assign(
        employees["hr"].user, published_course.published_version_id, employees["peer"].pk
    )
    finish_material(employees["peer"], peer)
    api_client.force_authenticate(employees["manager"].user)
    summary = api_client.get("/api/v1/academy/enrollments/summary/")
    assert summary.status_code == 200
    assert summary.data["total"] == 2
    assert summary.data["not_started"] == 1
    assert summary.data["in_progress"] == 1
    assert summary.data["overdue"] == 1
    assert summary.data["completion_percent"] == "0.00"
    overdue = api_client.get("/api/v1/academy/enrollments/?overdue=true")
    assert overdue.data["count"] == 1
    assert overdue.data["results"][0]["id"] == str(enrollment.pk)
    absent = api_client.get("/api/v1/academy/enrollments/summary/?completion_state=completed")
    assert absent.data["total"] == 0
    assert absent.data["completion_percent"] is None


def test_course_create_replay_cannot_reveal_previous_entity_draft(
    api_client, employees, course_draft
):
    hr = employees["hr"]
    api_client.force_authenticate(hr.user)
    values = {"slug": "tenant-scoped-replay", "draft": course_draft}
    first = post(api_client, "/api/v1/academy/manage/courses/", values, "entity-key")
    assert first.status_code == 201
    hr.legal_entity = employees["other_entity"].legal_entity
    hr.department = employees["other_entity"].department
    hr.manager = None
    hr.save()
    second = post(api_client, "/api/v1/academy/manage/courses/", values, "entity-key")
    assert second.status_code == 409
    assert "draft" not in second.data
    assert api_client.get(f"/api/v1/academy/manage/courses/{first.data['id']}/").status_code == 404


def test_employee_transfer_hides_old_entity_content_without_erasing_results(
    api_client, employees, enrollment
):
    employee = employees["employee"]
    enrollment = finish_material(employee, enrollment)
    services.submit_attempt(employee.user, enrollment.pk, enrollment.version, answer_payload())
    employee.legal_entity = employees["other_entity"].legal_entity
    employee.department = employees["other_entity"].department
    employee.manager = None
    employee.save()
    api_client.force_authenticate(employee.user)
    assert api_client.get(f"/api/v1/academy/enrollments/{enrollment.pk}/").status_code == 404
    assert (
        api_client.get(f"/api/v1/academy/enrollments/{enrollment.pk}/learning/").status_code == 404
    )
    assert api_client.get("/api/v1/academy/enrollments/").data["count"] == 0
    enrollment.refresh_from_db()
    assert enrollment.completed_at is not None
    assert enrollment.attempts.count() == 1


def test_unrounded_threshold_and_past_deadline_are_separate_rules(
    api_client, employees, course_draft
):
    course_draft["passing_percent"] = 67
    course = services.create_course(employees["hr"].user, "threshold-course", course_draft)
    course = services.publish_course(employees["hr"].user, course.pk, course.version)
    enrollment = services.assign(
        employees["hr"].user,
        course.published_version_id,
        employees["employee"].pk,
        due_at=timezone.now() - timedelta(days=1),
    )
    enrollment = finish_material(employees["employee"], enrollment)
    answers = answer_payload()
    answers[-1]["selected_option_id"] = "b"
    api_client.force_authenticate(employees["employee"].user)
    response = post(
        api_client,
        f"/api/v1/academy/enrollments/{enrollment.pk}/submit-attempt/",
        {"expected_version": enrollment.version, "answers": answers},
    )
    assert response.status_code == 201
    assert response.data["attempt"]["score"] == "66.67"
    assert response.data["attempt"]["passed"] is False
    assert response.data["enrollment"]["overdue"] is True
    assert "submit_attempt" in response.data["enrollment"]["allowed_actions"]
