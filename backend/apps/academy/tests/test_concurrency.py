from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.db import close_old_connections, connection, connections
from rest_framework.test import APIClient

from apps.academy.models import Enrollment, QuizAttempt
from apps.identity.models import User

from .conftest import answer_payload, finish_material

pytestmark = pytest.mark.django_db(transaction=True)


def parallel_post(user_id, url, payloads):
    barrier = Barrier(len(payloads))

    def send(item):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(User.objects.get(pk=user_id))
            barrier.wait(timeout=10)
            key, payload = item
            result = client.post(url, payload, HTTP_IDEMPOTENCY_KEY=key)
            return result.status_code, result.get("Idempotency-Replayed")
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=len(payloads)) as executor:
        return list(executor.map(send, payloads))


def test_concurrent_quiz_submission_replays_one_attempt(employees, enrollment):
    if connection.vendor != "postgresql":
        pytest.skip("This test requires PostgreSQL row locks.")
    enrollment = finish_material(employees["employee"], enrollment)
    values = {"expected_version": enrollment.version, "answers": answer_payload(correct=False)}
    results = parallel_post(
        employees["employee"].user_id,
        f"/api/v1/academy/enrollments/{enrollment.pk}/submit-attempt/",
        [("same-attempt", values), ("same-attempt", values)],
    )
    assert sorted(results) == [(201, "false"), (201, "true")]
    assert QuizAttempt.objects.filter(enrollment=enrollment).count() == 1


def test_concurrent_different_attempt_keys_do_not_double_score(employees, enrollment):
    if connection.vendor != "postgresql":
        pytest.skip("This test requires PostgreSQL row locks.")
    enrollment = finish_material(employees["employee"], enrollment)
    values = {"expected_version": enrollment.version, "answers": answer_payload()}
    results = parallel_post(
        employees["employee"].user_id,
        f"/api/v1/academy/enrollments/{enrollment.pk}/submit-attempt/",
        [("first-attempt", values), ("second-attempt", values)],
    )
    assert sorted(result[0] for result in results) == [201, 409]
    assert QuizAttempt.objects.filter(enrollment=enrollment).count() == 1
    assert Enrollment.objects.get(pk=enrollment.pk).completed_at is not None


def test_concurrent_assignments_create_one_enrollment(employees, published_course):
    if connection.vendor != "postgresql":
        pytest.skip("This test requires PostgreSQL row locks.")
    values = {
        "employee": str(employees["employee"].pk),
        "course_version": str(published_course.published_version_id),
    }
    results = parallel_post(
        employees["hr"].user_id,
        "/api/v1/academy/enrollments/",
        [("first-assignment", values), ("second-assignment", values)],
    )
    assert sorted(result[0] for result in results) == [201, 409]
    assert Enrollment.objects.count() == 1


def test_concurrent_course_code_collision_returns_conflict(employees, course_draft):
    if connection.vendor != "postgresql":
        pytest.skip("This test requires PostgreSQL uniqueness behavior.")
    values = {"slug": "same-course-code", "draft": course_draft}
    results = parallel_post(
        employees["hr"].user_id,
        "/api/v1/academy/manage/courses/",
        [("first-course", values), ("second-course", values)],
    )
    assert sorted(result[0] for result in results) == [201, 409]
