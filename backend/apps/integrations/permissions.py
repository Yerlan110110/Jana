from rest_framework.exceptions import NotFound, PermissionDenied

from apps.identity.models import LegalEntity
from apps.identity.permissions import require_hr
from apps.identity.selectors import employee_for


def require_operator(user):
    require_hr(user)
    if not user.has_perm("integrations.operate_integrations"):
        raise PermissionDenied("An integration operator must perform this action.")


def operator_entities(user):
    require_operator(user)
    if user.is_superuser:
        return LegalEntity.objects.all()
    return LegalEntity.objects.filter(pk=employee_for(user).legal_entity_id)


def require_operator_entity(user, entity_id, *, lock=False):
    entities = operator_entities(user)
    if lock:
        entities = entities.select_for_update()
    entity = entities.filter(pk=entity_id).first()
    if entity is None:
        raise NotFound()
    return entity
