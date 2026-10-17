from rest_framework.exceptions import PermissionDenied

from .models import User
from .selectors import employee_for


def can_manage_employee(user, employee):
    if not user or not user.is_authenticated or not user.is_active or employee.user_id == user.pk:
        return False
    if user.is_superuser:
        return True
    caller = employee_for(user)
    if caller is None or caller.legal_entity_id != employee.legal_entity_id:
        return False
    return user.role == User.Role.HR or (
        user.role == User.Role.MANAGER and employee.manager_id == caller.pk
    )


def require_hr(user, legal_entity=None):
    if not user or not user.is_authenticated or not user.is_active:
        raise PermissionDenied("HR access is required.")
    if user.is_superuser:
        return
    employee = employee_for(user)
    entity_id = getattr(legal_entity, "pk", legal_entity)
    if (
        user.role != User.Role.HR
        or employee is None
        or (entity_id is not None and employee.legal_entity_id != entity_id)
    ):
        raise PermissionDenied("HR access within this legal entity is required.")
