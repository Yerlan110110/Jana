from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch

import pytest
from django.db import close_old_connections, connections, transaction
from rest_framework.test import APIClient

from apps.academy import services
from apps.academy.models import Enrollment
from apps.identity.models import Employee, User
from apps.notifications.models import Notification


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("source_change", ["entity_transfer", "deactivate"])
def test_assignment_rechecks_locked_employee_after_source_change(
    employees, published_course, source_change
):
    validated = Event()
    source_committed = Event()
    original_scope = services.assignment_scope
    calls = 0

    def pause_after_inner_validation(*args, **kwargs):
        nonlocal calls
        result = original_scope(*args, **kwargs)
        calls += 1
        if calls == 2:
            validated.set()
            assert source_committed.wait(15)
        return result

    def send_assignment():
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(User.objects.get(pk=employees["hr"].user_id))
            response = client.post(
                "/api/v1/academy/enrollments/",
                {
                    "employee": str(employees["employee"].pk),
                    "course_version": str(published_course.published_version_id),
                },
                HTTP_IDEMPOTENCY_KEY=f"review-{source_change}",
            )
            return response.status_code, response.data
        finally:
            connections.close_all()

    with patch("apps.academy.services.assignment_scope", side_effect=pause_after_inner_validation):
        with ThreadPoolExecutor(max_workers=1) as executor:
            result = executor.submit(send_assignment)
            try:
                assert validated.wait(15)
                with transaction.atomic():
                    target = Employee.objects.select_for_update().get(pk=employees["employee"].pk)
                    if source_change == "entity_transfer":
                        target.legal_entity = employees["other_entity"].legal_entity
                        target.department = employees["other_entity"].department
                        target.manager = None
                    else:
                        target.is_active = False
                    target.save()
            finally:
                source_committed.set()
            status, payload = result.result(timeout=20)

    target = Employee.objects.get(pk=employees["employee"].pk)
    persisted = Enrollment.objects.filter(employee=target).first()
    assert status in {403, 404, 409}, payload
    assert persisted is None
    assert not Notification.objects.filter(kind="course_assigned").exists()
