from django_filters import rest_framework as filters

from .models import Employee


class EmployeeFilter(filters.FilterSet):
    department = filters.UUIDFilter(field_name="department_id")

    class Meta:
        model = Employee
        fields = ["department", "is_active"]
