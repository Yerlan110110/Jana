from django.db.models import Q

from .models import Employee, User


def employee_for(user):
    if not user or not user.is_authenticated:
        return None
    return (
        Employee.objects.filter(user=user, is_active=True)
        .select_related("legal_entity", "department", "manager__user")
        .first()
    )


def visible_employees(user):
    base = Employee.objects.select_related("user", "legal_entity", "department", "manager")
    if not user or not user.is_authenticated or not user.is_active:
        return base.none()
    if user.is_superuser:
        return base
    employee = employee_for(user)
    if employee is None:
        return base.none()
    if user.role == User.Role.HR:
        return base.filter(legal_entity_id=employee.legal_entity_id)
    if user.role == User.Role.MANAGER:
        return base.filter(legal_entity_id=employee.legal_entity_id).filter(
            Q(pk=employee.pk) | Q(manager_id=employee.pk)
        )
    return base.filter(pk=employee.pk)
