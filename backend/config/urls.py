from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.views import HealthView, ReadyView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", HealthView.as_view(), name="health"),
    path("api/v1/ready/", ReadyView.as_view(), name="ready"),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="api-docs"),
    path("api/v1/", include("apps.identity.urls")),
    path("api/v1/", include("apps.notifications.urls")),
    path("api/v1/", include("apps.hr_requests.urls")),
    path("api/v1/", include("apps.academy.urls")),
    path("api/v1/", include("apps.knowledge.urls")),
    path("api/v1/", include("apps.integrations.urls")),
    path("api/v1/", include("apps.workbench.urls")),
]
