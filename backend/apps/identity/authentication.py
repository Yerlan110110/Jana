from drf_spectacular.authentication import SessionScheme
from rest_framework.authentication import SessionAuthentication as DRFSessionAuthentication


class SessionAuthentication(DRFSessionAuthentication):
    def authenticate_header(self, request):
        return "Session"


class JanaSessionScheme(SessionScheme):
    target_class = "apps.identity.authentication.SessionAuthentication"
    priority = 1
