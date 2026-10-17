from django_filters import rest_framework as filters

from .models import HRRequest
from .selectors import review_requests


class RequestFilter(filters.FilterSet):
    needs_my_action = filters.BooleanFilter(
        method="filter_needs_my_action",
        help_text="True restricts to the current review queue before pagination. False adds no restriction.",
    )
    employee = filters.UUIDFilter(field_name="employee_id")

    def filter_needs_my_action(self, queryset, name, value):
        if value:
            return queryset.filter(pk__in=review_requests(self.request.user).values("pk"))
        return queryset

    class Meta:
        model = HRRequest
        fields = ["kind", "status", "employee"]
