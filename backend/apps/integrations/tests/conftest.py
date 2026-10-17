import pytest
from django.contrib.auth.models import Permission


@pytest.fixture(autouse=True)
def enable_demo_fault_controls(settings):
    settings.INTEGRATIONS_ALLOW_MOCK_FAULTS = True


@pytest.fixture
def operator(employees):
    user = employees["hr"].user
    permission = Permission.objects.get(
        content_type__app_label="integrations", codename="operate_integrations"
    )
    user.user_permissions.add(permission)
    return user
