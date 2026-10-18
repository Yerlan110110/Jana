from rest_framework import serializers

from apps.core.serializers import StrictSerializer

from .models import Department, Employee, LegalEntity, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "role", "first_name", "last_name"]
        read_only_fields = fields


class LegalEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = LegalEntity
        fields = ["id", "code", "name"]


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "code", "name", "legal_entity"]


class EmployeeSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    legal_entity = LegalEntitySerializer(read_only=True)
    department = DepartmentSerializer(read_only=True)
    manager_name = serializers.CharField(source="manager.full_name", default=None, read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "user",
            "external_id",
            "full_name",
            "position",
            "legal_entity",
            "department",
            "manager",
            "manager_name",
            "hired_on",
            "leave_balance",
            "balance_as_of",
            "locale",
            "is_active",
            "source_revision",
            "synced_at",
        ]
        read_only_fields = fields


class LoginSerializer(StrictSerializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=256)


DEMO_ACCOUNT_CHOICES = ["employee", "manager", "hr", "employee_kg", "employee_uz"]


class DemoLoginSerializer(StrictSerializer):
    account = serializers.ChoiceField(choices=DEMO_ACCOUNT_CHOICES)


class DemoAccountsSerializer(serializers.Serializer):
    accounts = serializers.ListField(
        child=serializers.ChoiceField(choices=DEMO_ACCOUNT_CHOICES)
    )


class SessionSerializer(serializers.Serializer):
    user = UserSerializer()
    employee = EmployeeSerializer(allow_null=True)
    csrf_token = serializers.CharField()


class CSRFSerializer(serializers.Serializer):
    csrf_token = serializers.CharField()
