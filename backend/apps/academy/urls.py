from rest_framework.routers import DefaultRouter

from .views import CatalogViewSet, CourseAdminViewSet, EnrollmentViewSet

router = DefaultRouter()
router.register("academy/courses", CatalogViewSet, basename="academy-course")
router.register("academy/manage/courses", CourseAdminViewSet, basename="academy-course-admin")
router.register("academy/enrollments", EnrollmentViewSet, basename="academy-enrollment")
urlpatterns = router.urls
