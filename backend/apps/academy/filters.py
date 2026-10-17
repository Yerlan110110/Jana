from django.utils import timezone
from django_filters import rest_framework as filters

from .content import CATEGORIES
from .models import Course, Enrollment
from .selectors import completion_filter


class CatalogFilter(filters.FilterSet):
    category = filters.ChoiceFilter(field_name="published_version__category", choices=CATEGORIES)
    language = filters.ChoiceFilter(
        field_name="published_version__content_language",
        choices=[("ru", "Русский"), ("kk", "Қазақша")],
    )

    class Meta:
        model = Course
        fields = []


class EnrollmentFilter(filters.FilterSet):
    completion_state = filters.ChoiceFilter(
        method="filter_state",
        choices=[
            ("not_started", "Not started"),
            ("in_progress", "In progress"),
            ("completed", "Completed"),
        ],
    )
    overdue = filters.BooleanFilter(method="filter_overdue")
    has_failed_attempt = filters.BooleanFilter()
    category = filters.ChoiceFilter(field_name="course_version__category", choices=CATEGORIES)
    course = filters.UUIDFilter(field_name="course_version__course_id")
    due_before = filters.IsoDateTimeFilter(field_name="due_at", lookup_expr="lte")
    due_after = filters.IsoDateTimeFilter(field_name="due_at", lookup_expr="gte")

    class Meta:
        model = Enrollment
        fields = ["employee", "required"]

    def filter_state(self, queryset, name, value):
        return queryset.filter(completion_filter(value))

    def filter_overdue(self, queryset, name, value):
        overdue = dict(completed_at__isnull=True, due_at__lt=timezone.now())
        return queryset.filter(**overdue) if value else queryset.exclude(**overdue)
