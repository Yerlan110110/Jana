from django.contrib.auth import logout
from drf_spectacular.authentication import SessionScheme
from rest_framework.authentication import SessionAuthentication as DRFSessionAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .selectors import employee_for


class SessionAuthentication(DRFSessionAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, credentials = result
        if not user.is_superuser and employee_for(user) is None:
            logout(request._request)
            raise AuthenticationFailed(
                "Employee account is inactive or not provisioned.", code="employee_inactive"
            )
        return user, credentials

    def authenticate_header(self, request):
        return "Session"


class JanaSessionScheme(SessionScheme):
    target_class = "apps.identity.authentication.SessionAuthentication"
    priority = 1
