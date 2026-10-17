from django.urls import path

from .views import WorkbenchView

urlpatterns = [path("workbench/", WorkbenchView.as_view(), name="workbench")]
