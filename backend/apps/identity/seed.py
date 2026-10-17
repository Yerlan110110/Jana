"""Repeatable synthetic organization data. Never import real personnel here."""

import os
import secrets
from datetime import date, timedelta
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5

from django.db import transaction
from django.utils import timezone

from .models import Department, Employee, LegalEntity, User

SEED_VERSION = "synthetic-seed-v1"
DEPARTMENTS = [
    ("warehouse", "Склад", "Специалист склада"),
    ("pvz", "Сервисные отделения", "Специалист обслуживания"),
    ("support", "Поддержка", "Специалист поддержки"),
]
GIVEN_NAMES = [
    "Дана",
    "Арман",
    "Айдана",
    "Ержан",
    "Аружан",
    "Диас",
    "Меруерт",
    "Нұрсұлтан",
    "Анна",
    "Роман",
    "Әсем",
    "Данияр",
]
FAMILY_NAMES = [
    "Бекенов",
    "Омарова",
    "Ибраев",
    "Сәрсенова",
    "Есенов",
    "Ким",
    "Төлегенова",
    "Серікбаев",
    "Петрова",
    "Жұмабеков",
    "Кәрімова",
    "Иванов",
]


def synthetic_id(value):
    return uuid5(NAMESPACE_URL, f"https://github.com/Yerlan110110/Jana/synthetic/{value}")


@transaction.atomic
def seed_identity(password=None):
    password = password or os.getenv("DEMO_PASSWORD") or secrets.token_urlsafe(24)
    today = timezone.localdate()
    result = []

    def person(username, name, role, department, *, manager=None, index=0, new=False):
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "id": synthetic_id(f"user/{username}"),
                "role": role,
                "first_name": name.split()[0],
                "password": "!",
            },
        )
        if created:
            user.set_password(password)
            user.save(update_fields=["password", "updated_at"])
        external_id = f"SYN-{username}"
        employee, _ = Employee.objects.get_or_create(
            external_id=external_id,
            defaults={
                "id": synthetic_id(f"employee/{username}"),
                "user": user,
                "full_name": name,
                "position": "HR-специалист"
                if role == User.Role.HR
                else "Руководитель команды"
                if role == User.Role.MANAGER
                else dict((code, job) for code, _, job in DEPARTMENTS)[department.code],
                "legal_entity": department.legal_entity,
                "department": department,
                "manager": manager,
                "hired_on": today - timedelta(days=3)
                if new
                else date(2020, 3, 2) + timedelta(days=index * 37),
                "leave_balance": Decimal("0.00") if new else Decimal(24 - index % 5),
                "balance_as_of": today,
                "locale": "kk" if index % 4 == 3 else "ru",
                "source_revision": SEED_VERSION,
                "synced_at": timezone.now(),
            },
        )
        if employee.user_id != user.pk:
            raise ValueError(
                f"Synthetic account mapping conflict for {username}; existing data was preserved."
            )
        result.append(employee)
        return employee

    for entity_index, (code, name) in enumerate(
        [
            ("SYN-KZ-A", "Демо JanaMen — Астана (синтетическое юрлицо)"),
            ("SYN-KZ-B", "Демо JanaMen — Алматы (синтетическое юрлицо)"),
        ]
    ):
        entity, _ = LegalEntity.objects.get_or_create(
            code=code, defaults={"id": synthetic_id(f"entity/{code}"), "name": name}
        )
        departments = {}
        managers = {}
        for dept_index, (dept_code, dept_name, _) in enumerate(DEPARTMENTS):
            department, _ = Department.objects.get_or_create(
                legal_entity=entity,
                code=dept_code,
                defaults={"id": synthetic_id(f"department/{code}/{dept_code}"), "name": dept_name},
            )
            departments[dept_code] = department
            primary = entity_index == 0 and dept_index == 0
            username = "manager.demo" if primary else f"manager.{entity_index + 1}.{dept_code}.demo"
            manager_name = (
                "Аян Бекенов"
                if primary
                else [
                    "Әлия Кәрімова",
                    "Ерлан Есенов",
                    "Мария Ким",
                    "Дамир Ибраев",
                    "Алина Омарова",
                ][entity_index * 3 + dept_index - 1]
            )
            managers[dept_code] = person(
                username,
                manager_name,
                User.Role.MANAGER,
                department,
                index=entity_index * 3 + dept_index,
            )
        for hr_index in range(2):
            username = (
                ("hr.demo" if hr_index == 0 else "hr.alt.demo")
                if entity_index == 0
                else f"hr.{entity_index + 1}.{hr_index + 1}.demo"
            )
            name = ["Алия Серікқызы", "Елена Иванова", "Айсұлу Төлегенова", "Руслан Жұмабеков"][
                entity_index * 2 + hr_index
            ]
            person(
                username,
                name,
                User.Role.HR,
                departments["support"],
                index=hr_index + entity_index * 2,
            )
        for dept_index, (dept_code, _, _) in enumerate(DEPARTMENTS):
            for staff_index in range(8):
                index = entity_index * 24 + dept_index * 8 + staff_index
                username = f"employee.{entity_index + 1}.{dept_code}.{staff_index + 1:02d}.demo"
                name = f"{GIVEN_NAMES[index % len(GIVEN_NAMES)]} {FAMILY_NAMES[(index * 5 + 3) % len(FAMILY_NAMES)]}"
                new = entity_index == 0 and dept_code == "support" and staff_index == 7
                if entity_index == 0 and dept_code == "warehouse" and staff_index == 0:
                    username, name = "employee.demo", "Дана Нұрланқызы Әбдірахманова"
                elif entity_index == 0 and dept_code == "pvz" and staff_index == 0:
                    username, name = "otherteam.demo", "Тимур Есенов"
                elif entity_index == 1 and dept_code == "warehouse" and staff_index == 0:
                    username, name = "foreign.demo", "Мадина Омарова"
                elif new:
                    username, name = "new.demo", "Роман И."
                person(
                    username,
                    name,
                    User.Role.EMPLOYEE,
                    departments[dept_code],
                    manager=None if new else managers[dept_code],
                    index=index,
                    new=new,
                )
    return result
