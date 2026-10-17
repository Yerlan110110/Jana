from django.contrib import admin

from .models import DomainEvent, OutboxMessage


@admin.register(DomainEvent)
class DomainEventAdmin(admin.ModelAdmin):
    list_display = ["event_type", "aggregate_type", "aggregate_id", "created_at"]
    list_filter = ["event_type", "aggregate_type"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(OutboxMessage)
class OutboxAdmin(DomainEventAdmin):
    list_display = ["topic", "status", "attempt_count", "available_at"]
    list_filter = ["topic", "status"]
