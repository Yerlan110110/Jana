from datetime import date
from decimal import Decimal

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.identity.models import Department, Employee, LegalEntity, User


@pytest.fixture(autouse=True)
def isolate_request_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def fast_test_password_hasher(settings):
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def employees(db):
    entity = LegalEntity.objects.create(code="SYN-KZ", name="Synthetic Jana KZ")
    other_entity = LegalEntity.objects.create(code="SYN-KG", name="Synthetic Jana KG")
    department = Department.objects.create(code="WAREHOUSE", name="Warehouse", legal_entity=entity)
    other_department = Department.objects.create(
        code="SUPPORT", name="Support", legal_entity=entity
    )
    foreign_department = Department.objects.create(
        code="WAREHOUSE", name="Warehouse KG", legal_entity=other_entity
    )
    result = {}

    def create(key, role="employee", dept=department, manager=None):
        user = User.objects.create_user(
            username=key, password="Synthetic-test-password-42!", role=role
        )
        employee = Employee.objects.create(
            user=user,
            external_id=f"SYN-{key}",
            full_name=f"Synthetic {key}",
            position=role,
            legal_entity=dept.legal_entity,
            department=dept,
            manager=manager,
            hired_on=date(2024, 1, 10),
            leave_balance=Decimal("24.00"),
            balance_as_of=date(2026, 10, 17),
        )
        result[key] = employee
        return employee

    manager = create("manager", "manager")
    other_manager = create("other_manager", "manager", other_department)
    create("employee", manager=manager)
    create("peer", manager=manager)
    create("other_team", dept=other_department, manager=other_manager)
    create("hr", "hr", other_department)
    create("other_entity", dept=foreign_department)
    return result
