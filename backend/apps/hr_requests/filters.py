from django_filters import rest_framework as filters

from .models import HRRequest
from .selectors import WAITING_STATUSES, review_requests


class RequestFilter(filters.FilterSet):
    waiting = filters.BooleanFilter(
        method="filter_waiting",
        help_text="True restricts to requests awaiting manager or HR decision before pagination.",
    )
    needs_my_action = filters.BooleanFilter(
        method="filter_needs_my_action",
        help_text="True restricts to the current review queue before pagination. False adds no restriction.",
    )
    employee = filters.UUIDFilter(field_name="employee_id")

    def filter_waiting(self, queryset, name, value):
        if value:
            return queryset.filter(status__in=WAITING_STATUSES)
        return queryset

    def filter_needs_my_action(self, queryset, name, value):
        if value:
            return queryset.filter(pk__in=review_requests(self.request.user).values("pk"))
        return queryset

    class Meta:
        model = HRRequest
        fields = ["kind", "status", "employee"]
