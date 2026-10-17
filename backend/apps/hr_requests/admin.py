from django.contrib import admin

from .models import HRRequest, RequestHistory, RequestRevision


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(HRRequest)
class RequestAdmin(ReadOnlyAdmin):
    list_display = ["id", "employee", "kind", "status", "version", "submitted_at"]
    list_filter = ["kind", "status"]
    search_fields = ["employee__full_name", "reason"]


admin.site.register(RequestRevision, ReadOnlyAdmin)
admin.site.register(RequestHistory, ReadOnlyAdmin)
