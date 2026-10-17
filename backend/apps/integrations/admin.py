from django.contrib import admin

from .models import (
    DeliveryAttempt,
    DeliveryAttemptResult,
    DocumentExportReceipt,
    EntitySyncState,
    SourceImportBatch,
)


class IntegrationEvidenceAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


for model in [
    EntitySyncState,
    SourceImportBatch,
    DocumentExportReceipt,
    DeliveryAttempt,
    DeliveryAttemptResult,
]:
    admin.site.register(model, IntegrationEvidenceAdmin)
