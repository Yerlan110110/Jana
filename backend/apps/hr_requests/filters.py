from django_filters import rest_framework as filters

from .models import HRRequest


class RequestFilter(filters.FilterSet):
    employee = filters.UUIDFilter(field_name="employee_id")

    class Meta:
        model = HRRequest
        fields = ["kind", "status", "employee"]
