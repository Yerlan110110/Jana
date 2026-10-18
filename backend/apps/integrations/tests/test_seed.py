from io import StringIO

import pytest
from django.core.management import call_command

from apps.identity.models import User
from apps.identity.seed import seed_identity
from apps.integrations.models import (
    DemoOperatorGrant,
    EntitySyncState,
    MockDeliveryFault,
    SourceImportBatch,
)
from apps.integrations.seed import seed_integrations

pytestmark = pytest.mark.django_db


def test_demo_bootstrap_grants_only_synthetic_hr_and_preserves_revocation():
    employees = seed_identity(password="Synthetic-integration-password-82!")
    assert len(seed_integrations(employees)) == 4
    assert EntitySyncState.objects.count() == 4
    assert DemoOperatorGrant.objects.count() == 8
    assert SourceImportBatch.objects.filter(status="accepted").count() == 4
    assert SourceImportBatch.objects.filter(status="rejected").count() == 4
    for user in User.objects.all():
        assert user.has_perm("integrations.operate_integrations") == (user.role == "hr")
    hr = User.objects.get(username="hr.demo")
    hr.user_permissions.clear()
    assert seed_integrations(employees) == []
    assert not User.objects.get(pk=hr.pk).has_perm("integrations.operate_integrations")
    assert SourceImportBatch.objects.count() == 8


def test_seed_command_includes_integration_setup(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_SEED", "true")
    monkeypatch.setenv("DEMO_PASSWORD", "Synthetic-integration-password-82!")
    output = StringIO()
    call_command(
        "seed_demo",
        skip_requests=True,
        skip_academy=True,
        skip_knowledge=True,
        credentials_file=str(tmp_path / "credentials.json"),
        stdout=output,
    )
    assert EntitySyncState.objects.count() == 4
    assert User.objects.get(username="hr.demo").has_perm("integrations.operate_integrations")
    assert "integration-password" not in output.getvalue()


def test_delivery_demo_faults_preserve_operator_changes_on_rerun(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_SEED", "true")
    monkeypatch.setenv("DEMO_PASSWORD", "Synthetic-integration-password-82!")
    path = tmp_path / "credentials.json"
    call_command(
        "seed_demo",
        skip_academy=True,
        skip_knowledge=True,
        credentials_file=str(path),
        stdout=StringIO(),
    )
    assert MockDeliveryFault.objects.count() == 2
    fault = MockDeliveryFault.objects.get(permanent_failure=True)
    fault.permanent_failure = False
    fault.save()
    call_command(
        "seed_demo",
        skip_academy=True,
        skip_knowledge=True,
        credentials_file=str(path),
        stdout=StringIO(),
    )
    fault.refresh_from_db()
    assert fault.permanent_failure is False
    assert SourceImportBatch.objects.count() == 8
