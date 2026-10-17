from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ExportViewSet, ImportSnapshotView, SourceImportViewSet, SourceStateViewSet

router = DefaultRouter()
router.register("integrations/imports", SourceImportViewSet, basename="integration-import")
router.register("integrations/sources", SourceStateViewSet, basename="integration-source")
router.register("integrations/exports", ExportViewSet, basename="integration-export")
urlpatterns = [
    path(
        "integrations/mock-1c/imports/",
        ImportSnapshotView.as_view(),
        name="integration-import-snapshot",
    ),
    *router.urls,
]
