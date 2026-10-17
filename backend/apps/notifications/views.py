from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer
from .services import mark_read


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter(
                "unread",
                bool,
                description="True returns unread owned notifications. False adds no restriction.",
            )
        ]
    )
)
class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    ordering_fields = ["created_at"]
    filterset_fields = ["kind"]

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Notification.objects.none()
        queryset = Notification.objects.filter(recipient=self.request.user)
        if self.request.query_params.get("unread") == "true":
            queryset = queryset.filter(read_at__isnull=True)
        return queryset

    @extend_schema(request=None, responses=NotificationSerializer)
    @action(detail=True, methods=["post"], url_path="read")
    def read(self, request, pk=None):
        return Response(self.get_serializer(mark_read(request.user, pk)).data)
