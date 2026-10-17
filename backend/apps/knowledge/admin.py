from django.contrib import admin

from .models import (
    AssistantAnswer,
    KnowledgeChunk,
    KnowledgeDocument,
    KnowledgeGapCase,
    KnowledgeRevision,
)


class ReadOnlyKnowledgeAdmin(admin.ModelAdmin):
    def get_readonly_fields(self, request, obj=None):
        return [field.name for field in self.model._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


for model in (
    KnowledgeDocument,
    KnowledgeRevision,
    KnowledgeChunk,
    AssistantAnswer,
    KnowledgeGapCase,
):
    admin.site.register(model, ReadOnlyKnowledgeAdmin)
