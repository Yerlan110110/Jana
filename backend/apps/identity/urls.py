from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CSRFView,
    DemoLoginView,
    DepartmentViewSet,
    EmployeeViewSet,
    LegalEntityViewSet,
    LoginView,
    LogoutView,
    MeView,
)

router = DefaultRouter()
router.register("employees", EmployeeViewSet, basename="employee")
router.register("departments", DepartmentViewSet, basename="department")
router.register("legal-entities", LegalEntityViewSet, basename="legal-entity")
urlpatterns = [
    path("auth/csrf/", CSRFView.as_view(), name="csrf"),
    path("auth/demo-login/", DemoLoginView.as_view(), name="demo-login"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("", include(router.urls)),
]
