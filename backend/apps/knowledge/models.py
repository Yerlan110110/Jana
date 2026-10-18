from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models import AppendOnlyModel, TimestampedModel


class Audience(models.TextChoices):
    ALL = "all", "All employees"
    EMPLOYEE = "employee", "Employees"
    MANAGER = "manager", "Managers"
    HR = "hr", "HR"


class KnowledgeDocument(TimestampedModel):
    class State(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    slug = models.SlugField(max_length=100, unique=True)
    title = models.CharField(max_length=240)
    summary = models.TextField(blank=True)
    language = models.CharField(max_length=2, choices=[("ru", "Русский"), ("kk", "Қазақша")])
    topic = models.SlugField(max_length=80)
    owner = models.ForeignKey("identity.Employee", on_delete=models.PROTECT)
    legal_entity = models.ForeignKey(
        "identity.LegalEntity", on_delete=models.PROTECT, null=True, blank=True
    )
    department = models.ForeignKey(
        "identity.Department", on_delete=models.PROTECT, null=True, blank=True
    )
    audience = models.CharField(max_length=16, choices=Audience, default=Audience.ALL)
    draft_sections = models.JSONField(default=list)
    draft_knowledge_check = models.JSONField(null=True, blank=True)
    effective_from = models.DateField(default=timezone.localdate)
    effective_until = models.DateField(null=True, blank=True)
    is_synthetic = models.BooleanField(default=True)
    state = models.CharField(max_length=16, choices=State, default=State.DRAFT)
    version = models.PositiveIntegerField(default=1)
    current_revision = models.ForeignKey(
        "KnowledgeRevision", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    class Meta:
        ordering = ["title", "id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(department__isnull=True) | models.Q(legal_entity__isnull=False),
                name="knowledge_department_requires_entity",
            ),
            models.CheckConstraint(
                condition=models.Q(effective_until__isnull=True)
                | models.Q(effective_until__gt=models.F("effective_from")),
                name="knowledge_document_effective_dates",
            ),
            models.CheckConstraint(
                condition=~models.Q(state="published") | models.Q(current_revision__isnull=False),
                name="knowledge_published_requires_revision",
            ),
        ]

    def clean(self):
        if self.department_id and self.department.legal_entity_id != self.legal_entity_id:
            raise ValidationError({"department": "Choose a department in this legal entity."})
        if self.legal_entity_id and self.owner.legal_entity_id != self.legal_entity_id:
            raise ValidationError({"owner": "Choose an HR owner in this legal entity."})
        if self.current_revision_id and self.current_revision.document_id != self.pk:
            raise ValidationError({"current_revision": "The revision belongs to another document."})


class KnowledgeRevision(AppendOnlyModel):
    document = models.ForeignKey(
        KnowledgeDocument, on_delete=models.PROTECT, related_name="revisions"
    )
    number = models.PositiveIntegerField()
    title = models.CharField(max_length=240)
    summary = models.TextField(blank=True)
    language = models.CharField(max_length=2)
    topic = models.CharField(max_length=80)
    owner = models.ForeignKey("identity.Employee", on_delete=models.PROTECT)
    legal_entity = models.ForeignKey("identity.LegalEntity", on_delete=models.PROTECT, null=True)
    department = models.ForeignKey("identity.Department", on_delete=models.PROTECT, null=True)
    audience = models.CharField(max_length=16, choices=Audience)
    sections = models.JSONField()
    effective_from = models.DateField()
    effective_until = models.DateField(null=True)
    is_synthetic = models.BooleanField()
    content_hash = models.CharField(max_length=64)
    previous_revision = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="next_revisions"
    )
    knowledge_check = models.JSONField(null=True, blank=True)
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    published_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["document_id", "number"]
        constraints = [
            models.UniqueConstraint(
                fields=["document", "number"], name="knowledge_revision_number"
            ),
            models.CheckConstraint(
                condition=models.Q(effective_until__isnull=True)
                | models.Q(effective_until__gt=models.F("effective_from")),
                name="knowledge_revision_effective_dates",
            ),
        ]


class KnowledgeChunk(AppendOnlyModel):
    revision = models.ForeignKey(KnowledgeRevision, on_delete=models.PROTECT, related_name="chunks")
    section_number = models.PositiveIntegerField()
    ordinal = models.PositiveIntegerField()
    heading = models.CharField(max_length=240)
    text = models.TextField()
    start_offset = models.PositiveIntegerField()
    end_offset = models.PositiveIntegerField()
    content_hash = models.CharField(max_length=64)

    class Meta:
        ordering = ["revision_id", "ordinal"]
        constraints = [
            models.UniqueConstraint(fields=["revision", "ordinal"], name="knowledge_chunk_ordinal"),
            models.CheckConstraint(
                condition=models.Q(end_offset__gt=models.F("start_offset")),
                name="knowledge_chunk_nonempty_offsets",
            ),
        ]

    @property
    def locator(self):
        return f"§ {self.section_number}. {self.heading}"


class PolicyUpdateAssignment(TimestampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        SUPERSEDED = "superseded", "Superseded"

    revision = models.ForeignKey(
        KnowledgeRevision, on_delete=models.PROTECT, related_name="update_assignments"
    )
    employee = models.ForeignKey(
        "identity.Employee", on_delete=models.PROTECT, related_name="policy_update_assignments"
    )
    status = models.CharField(max_length=16, choices=Status, default=Status.PENDING)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    completed_at = models.DateTimeField(null=True, blank=True)
    superseded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["revision", "employee"], name="knowledge_update_employee_unique"
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(status="pending", completed_at__isnull=True, superseded_at__isnull=True)
                    | models.Q(status="completed", completed_at__isnull=False, superseded_at__isnull=True)
                    | models.Q(status="superseded", completed_at__isnull=True, superseded_at__isnull=False)
                ),
                name="knowledge_update_status_timestamps",
            ),
        ]
        indexes = [models.Index(fields=["employee", "status", "created_at"])]


class PolicyUpdateAttempt(AppendOnlyModel):
    assignment = models.ForeignKey(
        PolicyUpdateAssignment, on_delete=models.PROTECT, related_name="attempts"
    )
    idempotency_key = models.CharField(max_length=128)
    selected_option = models.PositiveSmallIntegerField()
    is_correct = models.BooleanField()

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["assignment", "idempotency_key"],
                name="knowledge_update_attempt_idempotency",
            ),
            models.CheckConstraint(
                condition=models.Q(selected_option__gte=0, selected_option__lte=2),
                name="knowledge_update_option_bounds",
            ),
        ]


class AssistantAnswer(AppendOnlyModel):
    class Mode(models.TextChoices):
        GENERATED = "generated", "Model-selected source sentences"
        EXTRACTIVE = "extractive", "Source excerpts"
        INSUFFICIENT = "insufficient_evidence", "No supported answer"
        UNAVAILABLE = "provider_unavailable", "AI provider unavailable"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    client_message_id = models.UUIDField()
    question = models.TextField()
    language = models.CharField(max_length=2)
    mode = models.CharField(max_length=32, choices=Mode)
    reason = models.CharField(max_length=60)
    claims = models.JSONField(default=list)
    provider = models.CharField(max_length=40, blank=True)
    model = models.CharField(max_length=160, blank=True)

    class Meta:
        ordering = ["-created_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "client_message_id"], name="knowledge_answer_client_message"
            )
        ]


class KnowledgeGapCase(TimestampedModel):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        RESOLVED = "resolved", "Resolved"

    employee = models.ForeignKey("identity.Employee", on_delete=models.PROTECT)
    legal_entity = models.ForeignKey("identity.LegalEntity", on_delete=models.PROTECT)
    answer = models.OneToOneField(
        AssistantAnswer, on_delete=models.PROTECT, related_name="gap_case"
    )
    question = models.TextField()
    details = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status, default=Status.OPEN)
    version = models.PositiveIntegerField(default=1)
    response = models.TextField(blank=True)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True)
    resolved_at = models.DateTimeField(null=True)
    published_revision = models.ForeignKey(
        KnowledgeRevision, on_delete=models.PROTECT, null=True, blank=True, related_name="gap_cases"
    )

    class Meta:
        ordering = ["-created_at", "id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        status="open",
                        resolved_at__isnull=True,
                        resolved_by__isnull=True,
                        published_revision__isnull=True,
                    )
                    | models.Q(
                        status="resolved", resolved_at__isnull=False, resolved_by__isnull=False
                    )
                ),
                name="knowledge_gap_resolution_state",
            )
        ]
