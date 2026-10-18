from django.urls import path

from . import views

urlpatterns = [
    path("knowledge/documents/", views.DocumentListView.as_view(), name="knowledge-documents"),
    path(
        "knowledge/documents/<uuid:pk>/",
        views.DocumentDetailView.as_view(),
        name="knowledge-document",
    ),
    path("knowledge/citations/<uuid:pk>/", views.CitationView.as_view(), name="knowledge-citation"),
    path("knowledge/updates/", views.PolicyUpdateListView.as_view(), name="knowledge-updates"),
    path(
        "knowledge/updates/<uuid:pk>/",
        views.PolicyUpdateDetailView.as_view(),
        name="knowledge-update",
    ),
    path(
        "knowledge/updates/<uuid:pk>/attempt/",
        views.PolicyUpdateAttemptView.as_view(),
        name="knowledge-update-attempt",
    ),
    path(
        "knowledge/admin/documents/",
        views.AdminDocumentListView.as_view(),
        name="knowledge-admin-documents",
    ),
    path(
        "knowledge/admin/documents/<uuid:pk>/",
        views.AdminDocumentDetailView.as_view(),
        name="knowledge-admin-document",
    ),
    path(
        "knowledge/admin/documents/<uuid:pk>/publish/",
        views.PublishDocumentView.as_view(),
        name="knowledge-publish",
    ),
    path(
        "knowledge/admin/documents/<uuid:pk>/archive/",
        views.ArchiveDocumentView.as_view(),
        name="knowledge-archive",
    ),
    path(
        "knowledge/admin/documents/<uuid:pk>/revisions/",
        views.AdminRevisionListView.as_view(),
        name="knowledge-revisions",
    ),
    path("assistant/answers/", views.AnswerListCreateView.as_view(), name="knowledge-answers"),
    path("assistant/answers/<uuid:pk>/", views.AnswerDetailView.as_view(), name="knowledge-answer"),
    path("knowledge/gaps/", views.GapCaseListView.as_view(), name="knowledge-gaps"),
    path(
        "knowledge/gaps/<uuid:pk>/policy-reference/",
        views.GapPolicyReferenceView.as_view(),
        name="knowledge-gap-policy-reference",
    ),
    path("knowledge/gaps/<uuid:pk>/", views.GapCaseDetailView.as_view(), name="knowledge-gap"),
    path(
        "knowledge/gaps/<uuid:pk>/resolve/",
        views.GapResolutionView.as_view(),
        name="knowledge-resolve-gap",
    ),
]
