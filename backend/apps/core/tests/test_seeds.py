import json
import stat
from datetime import datetime
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection

from apps.core.models import DomainEvent, OutboxMessage
from apps.hr_requests import services
from apps.hr_requests.models import HRRequest, RequestRevision
from apps.hr_requests.seed import seed_requests
from apps.identity.models import Department, Employee, LegalEntity, User
from apps.identity.seed import seed_identity
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db
PASSWORD = "Synthetic-fixture-password-82!"


def test_seed_populates_distinct_teams_roles_and_empty_new_employee():
    employees = seed_identity(PASSWORD)
    assert len(employees) == 116
    assert LegalEntity.objects.count() == 4
    assert Department.objects.count() == 12
    assert User.objects.filter(role="employee").count() == 96
    assert User.objects.filter(role="manager").count() == 12
    assert User.objects.filter(role="hr").count() == 8
    dana = Employee.objects.get(user__username="employee.demo")
    assert dana.full_name == "Дана Нұрланқызы Әбдірахманова"
    assert dana.manager.user.username == "manager.demo"
    newcomer = Employee.objects.get(user__username="new.demo")
    assert newcomer.manager is None and newcomer.leave_balance == 0
    assert all(employee.source_revision == "synthetic-seed-v1" for employee in employees)


def test_request_seed_covers_all_states_and_preserves_user_changes():
    employees = seed_identity(PASSWORD)
    created = seed_requests(employees)
    assert len(created) == HRRequest.objects.count() == 242
    dana = Employee.objects.get(user__username="employee.demo")
    for kind in HRRequest.Kind.values:
        assert set(
            HRRequest.objects.filter(employee=dana, kind=kind).values_list("status", flat=True)
        ) == set(HRRequest.Status.values)
    assert not HRRequest.objects.filter(employee__user__username="new.demo").exists()
    assert OutboxMessage.objects.count() == HRRequest.objects.filter(status="approved").count()
    assert Notification.objects.filter(read_at__isnull=False).exists()
    assert Notification.objects.filter(read_at__isnull=True).exists()
    returned = HRRequest.objects.get(employee=dana, kind="leave", status="returned")
    assert returned.submission_number == 2
    submitted = list(returned.revisions.order_by("number"))
    assert [revision.number for revision in submitted] == [1, 2]
    assert submitted[0].payload["reason"] != submitted[1].payload["reason"]
    draft = HRRequest.objects.get(employee=dana, kind="leave", status="draft")
    changed = services.update_draft(
        dana.user, draft.pk, draft.version, {"reason": "Изменено после первого наполнения"}
    )
    counts = (
        DomainEvent.objects.count(),
        RequestRevision.objects.count(),
        Notification.objects.count(),
    )
    assert seed_requests(employees) == []
    changed.refresh_from_db()
    assert changed.reason == "Изменено после первого наполнения"
    assert changed.version == 2
    assert counts == (
        DomainEvent.objects.count(),
        RequestRevision.objects.count(),
        Notification.objects.count(),
    )


def test_identity_seed_preserves_imported_facts_and_existing_passwords():
    seed_identity(PASSWORD)
    dana = Employee.objects.get(user__username="employee.demo")
    dana.position = "Изменено интеграцией"
    dana.source_revision = "synthetic-source-revision-2"
    dana.save()
    seed_identity("A-new-password-that-must-not-reset-existing-82!")
    dana.refresh_from_db()
    dana.user.refresh_from_db()
    assert dana.position == "Изменено интеграцией"
    assert dana.source_revision == "synthetic-source-revision-2"
    assert dana.user.check_password(PASSWORD)
    assert Employee.objects.count() == 116


def test_seed_cli_uses_env_and_private_credentials_file_preserves_password_on_rerun(
    tmp_path, settings, monkeypatch
):
    settings.DEBUG = True
    monkeypatch.setenv("DEMO_PASSWORD", PASSWORD)
    path = tmp_path / "demo-credentials.json"
    output = StringIO()
    call_command(
        "seed_demo",
        credentials_file=str(path),
        skip_academy=True,
        skip_knowledge=True,
        stdout=output,
    )
    first = json.loads(path.read_text())
    assert first["synthetic"] is True
    assert len(first["accounts"]) == 116
    assert first["modules"]["hr_requests"] == 242
    assert all(account["password"] == PASSWORD for account in first["accounts"])
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert PASSWORD not in output.getvalue()
    monkeypatch.setenv("DEMO_PASSWORD", "Replacement-password-not-a-reset-83!")
    call_command(
        "seed_demo",
        credentials_file=str(path),
        skip_academy=True,
        skip_knowledge=True,
        stdout=output,
    )
    second = json.loads(path.read_text())
    assert all(account["password"] == PASSWORD for account in second["accounts"])
    assert HRRequest.objects.count() == 242
    assert second["modules"]["hr_requests"] == 0


def test_non_demo_runtime_does_not_seed_without_explicit_flag(settings, monkeypatch, tmp_path):
    settings.DEBUG = False
    monkeypatch.delenv("DEMO_SEED", raising=False)
    with pytest.raises(CommandError, match="DEMO_SEED=true"):
        call_command("seed_demo", credentials_file=str(tmp_path / "demo-credentials.json"))
    assert not User.objects.exists()


def test_credentials_write_failure_rolls_back_new_records(settings, monkeypatch, tmp_path):
    settings.DEBUG = True
    monkeypatch.setenv("DEMO_PASSWORD", PASSWORD)
    blocked = tmp_path / "not-a-directory"
    blocked.write_text("Existing file must stay intact.")
    with pytest.raises(CommandError, match="rolled back"):
        call_command(
            "seed_demo",
            credentials_file=str(blocked / "demo-credentials.json"),
            skip_requests=True,
            skip_academy=True,
            skip_knowledge=True,
        )
    assert not User.objects.exists()
    assert blocked.read_text() == "Existing file must stay intact."


def test_complete_seed_serializes_module_manifests_and_preserves_combined_records(
    settings, monkeypatch, tmp_path
):
    from apps.academy.models import Course, Enrollment, QuizAttempt
    from apps.integrations.models import SourceImportBatch
    from apps.knowledge.models import KnowledgeDocument

    settings.DEBUG = True
    monkeypatch.setenv("DEMO_PASSWORD", PASSWORD)
    path = tmp_path / "complete-demo.json"
    output = StringIO()
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("SET LOCAL statement_timeout = '10s'")
    call_command("seed_demo", credentials_file=str(path), stdout=output)
    first = json.loads(path.read_text())
    academy = first["modules"]["academy"]
    assert academy["course_count"] == 30
    assert academy["enrollment_count"] == 189
    assert academy["lesson_count"] == 60
    assert academy["question_count"] == 90
    assert datetime.fromisoformat(academy["demo_employee"]["computed_at"]).tzinfo is not None
    assert Employee.objects.count() == 116
    assert HRRequest.objects.count() == 242
    assert KnowledgeDocument.objects.count() > 20
    assert SourceImportBatch.objects.filter(status="accepted").count() == 4
    models = [
        Employee,
        HRRequest,
        Course,
        Enrollment,
        QuizAttempt,
        KnowledgeDocument,
        SourceImportBatch,
        DomainEvent,
    ]
    counts = [model.objects.count() for model in models]
    call_command("seed_demo", credentials_file=str(path), stdout=output)
    second = json.loads(path.read_text())
    assert second["modules"]["academy"]["preserved_existing"] is True
    assert counts == [model.objects.count() for model in models]
    assert PASSWORD not in output.getvalue()
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
