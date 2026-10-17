from rest_framework.routers import DefaultRouter

from .views import RequestViewSet

router = DefaultRouter()
router.register("requests", RequestViewSet, basename="hr-request")
urlpatterns = router.urls
