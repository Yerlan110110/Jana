from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .filters import EmployeeFilter
from .models import Department, LegalEntity
from .selectors import employee_for, visible_employees
from .serializers import (
    CSRFSerializer,
    DepartmentSerializer,
    EmployeeSerializer,
    LegalEntitySerializer,
    LoginSerializer,
    SessionSerializer,
    UserSerializer,
)


def session_data(request):
    employee = employee_for(request.user)
    return {
        "user": UserSerializer(request.user).data,
        "employee": EmployeeSerializer(employee).data if employee else None,
        "csrf_token": get_token(request),
    }


class CSRFView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses=CSRFSerializer, auth=[])
    def get(self, request):
        return Response({"csrf_token": get_token(request)})


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def get_authenticate_header(self, request):
        return "Session"

    @extend_schema(request=LoginSerializer, responses=SessionSerializer, auth=[])
    def post(self, request):
        data = LoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = authenticate(request, **data.validated_data)
        if user is None:
            raise AuthenticationFailed("Invalid credentials.")
        if not user.is_superuser and employee_for(user) is None:
            raise AuthenticationFailed("Employee account is inactive or not provisioned.")
        login(request, user)
        return Response(session_data(request))


class LogoutView(APIView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    @extend_schema(responses=SessionSerializer)
    def get(self, request):
        return Response(session_data(request))


class EmployeeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = EmployeeSerializer
    search_fields = ["full_name", "position", "external_id"]
    filterset_class = EmployeeFilter
    ordering_fields = ["full_name", "hired_on"]

    def get_queryset(self):
        return visible_employees(self.request.user)


class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DepartmentSerializer
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code"]

    def get_queryset(self):
        employee_ids = visible_employees(self.request.user).values("department_id")
        return Department.objects.filter(id__in=employee_ids)


class LegalEntityViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = LegalEntitySerializer

    def get_queryset(self):
        return LegalEntity.objects.filter(
            id__in=visible_employees(self.request.user).values("legal_entity_id")
        )
