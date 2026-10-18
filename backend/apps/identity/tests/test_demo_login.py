from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.identity.models import Department, Employee, LegalEntity, User

pytestmark = pytest.mark.django_db


@pytest.fixture
def demo_users(db):
    entity = LegalEntity.objects.create(code="SYN-KZ", name="Synthetic Jana KZ")
    kg_entity = LegalEntity.objects.create(code="SYN-KG", name="Synthetic Jana KG")
    uz_entity = LegalEntity.objects.create(code="SYN-UZ", name="Synthetic Jana UZ")
    departments = {
        entity: Department.objects.create(code="HQ", name="HQ", legal_entity=entity),
        kg_entity: Department.objects.create(
            code="HQ", name="HQ KG", legal_entity=kg_entity
        ),
        uz_entity: Department.objects.create(
            code="HQ", name="HQ UZ", legal_entity=uz_entity
        ),
    }
    for role, username, dept in (
        ("employee", "employee.demo", departments[entity]),
        ("manager", "manager.demo", departments[entity]),
        ("hr", "hr.demo", departments[entity]),
        ("employee", "employee.kg.demo", departments[kg_entity]),
        ("employee", "employee.uz.demo", departments[uz_entity]),
    ):
        user = User.objects.create_user(username=username, password="unused-42!", role=role)
        Employee.objects.create(
            user=user,
            external_id=f"SYN-{username}",
            full_name=f"Synthetic {role}",
            position=role,
            legal_entity=dept.legal_entity,
            department=dept,
            hired_on=date(2024, 1, 10),
            leave_balance=Decimal("24.00"),
            balance_as_of=date(2026, 10, 17),
        )


def csrf_token(client):
    return client.get("/api/v1/auth/csrf/").data["csrf_token"]


def test_demo_login_hidden_when_flag_off(settings, demo_users):
    settings.JANAMEN_DEMO_LOGIN = False
    client = APIClient(enforce_csrf_checks=True)
    assert client.get("/api/v1/auth/demo-login/").status_code == 404
    response = client.post(
        "/api/v1/auth/demo-login/",
        {"account": "employee"},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token(client),
    )
    assert response.status_code == 404


def test_demo_login_lists_accounts_when_flag_on(settings, demo_users):
    settings.JANAMEN_DEMO_LOGIN = True
    client = APIClient()
    response = client.get("/api/v1/auth/demo-login/")
    assert response.status_code == 200
    assert response.data["accounts"] == [
        "employee",
        "manager",
        "hr",
        "employee_kg",
        "employee_uz",
    ]


def test_demo_login_employee_session(settings, demo_users):
    settings.JANAMEN_DEMO_LOGIN = True
    client = APIClient(enforce_csrf_checks=True)
    response = client.post(
        "/api/v1/auth/demo-login/",
        {"account": "employee"},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token(client),
    )
    assert response.status_code == 200
    assert response.data["user"]["username"] == "employee.demo"
    me = client.get("/api/v1/auth/me/")
    assert me.status_code == 200
    assert me.data["user"]["username"] == "employee.demo"


def test_demo_login_kyrgyz_employee_session(settings, demo_users):
    settings.JANAMEN_DEMO_LOGIN = True
    client = APIClient(enforce_csrf_checks=True)
    response = client.post(
        "/api/v1/auth/demo-login/",
        {"account": "employee_kg"},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token(client),
    )
    assert response.status_code == 200
    assert response.data["user"]["username"] == "employee.kg.demo"
    me = client.get("/api/v1/auth/me/")
    assert me.status_code == 200
    assert me.data["user"]["username"] == "employee.kg.demo"


def test_demo_login_rejects_unknown_account(settings, demo_users):
    settings.JANAMEN_DEMO_LOGIN = True
    client = APIClient(enforce_csrf_checks=True)
    response = client.post(
        "/api/v1/auth/demo-login/",
        {"account": "superuser"},
        format="json",
        HTTP_X_CSRFTOKEN=csrf_token(client),
    )
    assert response.status_code == 400


def test_demo_login_requires_csrf(settings, demo_users):
    settings.JANAMEN_DEMO_LOGIN = True
    client = APIClient(enforce_csrf_checks=True)
    response = client.post(
        "/api/v1/auth/demo-login/", {"account": "employee"}, format="json"
    )
    assert response.status_code == 403


def test_demo_login_get_is_not_throttled(settings, demo_users):
    settings.JANAMEN_DEMO_LOGIN = True
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": {
            **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
            "login": "2/min",
        },
    }
    client = APIClient()
    statuses = [
        client.get("/api/v1/auth/demo-login/").status_code for _ in range(5)
    ]
    assert statuses == [200] * 5
