import unicodedata

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.serializers import StrictSerializer
from apps.identity.models import Department, Employee, LegalEntity
from apps.identity.selectors import employee_for

from .models import (
    AssistantAnswer,
    Audience,
    KnowledgeDocument,
    KnowledgeGapCase,
    KnowledgeRevision,
)
from .presentation import present_policy_reference
from .services import draft_hash

LANGUAGE_CHOICES = [("ru", "Русский"), ("kk", "Қазақша")]


class SectionSerializer(StrictSerializer):
    heading = serializers.CharField(max_length=240)
    text = serializers.CharField(min_length=20, max_length=12000, trim_whitespace=True)


class DocumentCreateSerializer(StrictSerializer):
    slug = serializers.SlugField(max_length=100)
    title = serializers.CharField(max_length=240)
    summary = serializers.CharField(max_length=4000, allow_blank=True, required=False, default="")
    language = serializers.ChoiceField(choices=LANGUAGE_CHOICES)
    topic = serializers.SlugField(max_length=80)
    owner = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all(), required=False)
    legal_entity = serializers.PrimaryKeyRelatedField(
        queryset=LegalEntity.objects.all(), allow_null=True, required=False
    )
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), allow_null=True, required=False
    )
    audience = serializers.ChoiceField(choices=Audience.choices, default=Audience.ALL)
    draft_sections = SectionSerializer(many=True, max_length=40)
    effective_from = serializers.DateField(required=False)
    effective_until = serializers.DateField(allow_null=True, required=False)
    is_synthetic = serializers.BooleanField(default=True)

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and not request.user.is_superuser:
            employee = employee_for(request.user)
            entity_id = employee.legal_entity_id if employee else None
            fields["owner"].queryset = Employee.objects.filter(
                legal_entity_id=entity_id, is_active=True, user__is_active=True, user__role="hr"
            )
            if "legal_entity" in fields:
                fields["legal_entity"].queryset = LegalEntity.objects.filter(pk=entity_id)
            fields["department"].queryset = Department.objects.filter(legal_entity_id=entity_id)
        return fields

    def validate_draft_sections(self, value):
        if sum(len(section["text"]) for section in value) > 120000:
            raise serializers.ValidationError(
                "Keep the document below 120,000 characters or split it into separate documents."
            )
        return value


class DocumentUpdateSerializer(DocumentCreateSerializer):
    expected_version = serializers.IntegerField(min_value=1)

    def get_fields(self):
        fields = super().get_fields()
        fields.pop("slug")
        fields.pop("legal_entity")
        for name, field in fields.items():
            field.required = name == "expected_version"
            field.default = serializers.empty
        return fields


class KnowledgeVersionCommandSerializer(StrictSerializer):
    expected_version = serializers.IntegerField(min_value=1)


class RevisionSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True, read_only=True)

    class Meta:
        model = KnowledgeRevision
        fields = [
            "id",
            "number",
            "title",
            "summary",
            "language",
            "topic",
            "owner",
            "legal_entity",
            "department",
            "audience",
            "sections",
            "effective_from",
            "effective_until",
            "is_synthetic",
            "content_hash",
            "published_at",
            "published_by",
        ]
        read_only_fields = fields


class DocumentAdminSerializer(serializers.ModelSerializer):
    current_revision = RevisionSerializer(read_only=True)
    draft_sections = SectionSerializer(many=True, read_only=True)
    has_unpublished_changes = serializers.SerializerMethodField()
    allowed_actions = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeDocument
        fields = [
            "id",
            "slug",
            "title",
            "summary",
            "language",
            "topic",
            "owner",
            "legal_entity",
            "department",
            "audience",
            "draft_sections",
            "effective_from",
            "effective_until",
            "is_synthetic",
            "state",
            "version",
            "current_revision",
            "has_unpublished_changes",
            "allowed_actions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.BooleanField())
    def get_has_unpublished_changes(self, obj):
        return obj.current_revision_id is None or obj.current_revision.content_hash != draft_hash(
            obj
        )

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_allowed_actions(self, obj):
        actions = ["edit_draft"]
        if obj.state != "published" or self.get_has_unpublished_changes(obj):
            actions.append("publish")
        if obj.state != "archived":
            actions.append("archive")
        return actions


class DocumentReadSerializer(serializers.ModelSerializer):
    revision = RevisionSerializer(source="current_revision", read_only=True)

    class Meta:
        model = KnowledgeDocument
        fields = ["id", "slug", "revision"]
        read_only_fields = fields


class CitationSerializer(serializers.Serializer):
    chunk_id = serializers.UUIDField()
    document_id = serializers.UUIDField()
    revision_id = serializers.UUIDField()
    revision_number = serializers.IntegerField()
    title = serializers.CharField()
    heading = serializers.CharField()
    locator = serializers.CharField()
    text = serializers.CharField()
    url = serializers.CharField()
    published_at = serializers.DateTimeField()
    effective_from = serializers.DateField()
    effective_until = serializers.DateField(allow_null=True)
    language = serializers.ChoiceField(choices=LANGUAGE_CHOICES)
    is_synthetic = serializers.BooleanField()
    is_current = serializers.BooleanField()
    content_hash = serializers.CharField()


class ClaimSupportSerializer(serializers.Serializer):
    chunk_id = serializers.UUIDField()
    quote = serializers.CharField()


class AnswerClaimSerializer(serializers.Serializer):
    text = serializers.CharField()
    supports = ClaimSupportSerializer(many=True)


class AnswerSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    client_message_id = serializers.UUIDField()
    question = serializers.CharField()
    language = serializers.ChoiceField(choices=LANGUAGE_CHOICES)
    mode = serializers.ChoiceField(choices=AssistantAnswer.Mode.choices)
    answer_strategy = serializers.ChoiceField(
        choices=["source_bound_selection", "ranked_excerpts", "refusal", "unavailable"]
    )
    reason = serializers.CharField()
    message = serializers.CharField()
    claims = AnswerClaimSerializer(many=True)
    citations = CitationSerializer(many=True)
    evidence_status = serializers.ChoiceField(
        choices=["current", "superseded", "unavailable", "not_applicable"]
    )
    provider = serializers.CharField(allow_blank=True)
    model = serializers.CharField(allow_blank=True)
    case_id = serializers.UUIDField(allow_null=True)
    allowed_actions = serializers.ListField(
        child=serializers.ChoiceField(choices=["ask_again", "escalate_to_hr", "open_hr_case"])
    )
    created_at = serializers.DateTimeField()


class QuestionSerializer(StrictSerializer):
    question = serializers.CharField(min_length=8, max_length=2000)
    language = serializers.ChoiceField(choices=LANGUAGE_CHOICES, default="ru")
    client_message_id = serializers.UUIDField()

    def validate_question(self, value):
        if any(unicodedata.category(char) in {"Cc", "Cf"} and char not in "\n\t" for char in value):
            raise serializers.ValidationError("Use plain text without hidden control characters.")
        return unicodedata.normalize("NFKC", value)


class ProviderErrorSerializer(serializers.Serializer):
    code = serializers.CharField()
    message = serializers.CharField()
    field_errors = serializers.DictField()
    request_id = serializers.UUIDField(allow_null=True)
    answer = AnswerSerializer()


class EscalationSerializer(StrictSerializer):
    answer_id = serializers.UUIDField()
    details = serializers.CharField(max_length=4000, required=False, default="", allow_blank=True)


class GapResolutionSerializer(KnowledgeVersionCommandSerializer):
    response = serializers.CharField(min_length=10, max_length=8000)
    published_revision_id = serializers.UUIDField(required=False, allow_null=True)


class PolicyReferenceSerializer(serializers.Serializer):
    revision_id = serializers.UUIDField()
    state = serializers.ChoiceField(choices=["current", "superseded", "unavailable"])
    revision = RevisionSerializer(allow_null=True)
    url = serializers.CharField()


class RehearsalRequestSerializer(StrictSerializer):
    expected_version = serializers.IntegerField(min_value=1)
    language = serializers.ChoiceField(choices=LANGUAGE_CHOICES, required=False)
    questions = serializers.ListField(
        child=serializers.CharField(min_length=8, max_length=2000),
        required=False,
        default=list,
        max_length=10,
    )
    gap_case_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list, max_length=10
    )

    def validate_questions(self, value):
        normalized = []
        for question in value:
            if any(
                unicodedata.category(char) in {"Cc", "Cf"} and char not in "\n\t"
                for char in question
            ):
                raise serializers.ValidationError(
                    "Use plain text without hidden control characters."
                )
            normalized.append(unicodedata.normalize("NFKC", question))
        return normalized

    def validate(self, attrs):
        if len(attrs["questions"]) + len(attrs["gap_case_ids"]) > 10:
            raise serializers.ValidationError(
                {"questions": ["A rehearsal compares at most 10 questions."]}
            )
        return attrs


class RehearsalExcerptSerializer(serializers.Serializer):
    origin = serializers.ChoiceField(choices=["published", "draft"])
    chunk_id = serializers.UUIDField(allow_null=True)
    revision_id = serializers.UUIDField(allow_null=True)
    revision_number = serializers.IntegerField(allow_null=True)
    document_id = serializers.UUIDField()
    title = serializers.CharField()
    heading = serializers.CharField()
    locator = serializers.CharField()
    text = serializers.CharField()
    content_hash = serializers.CharField()
    score = serializers.FloatField()
    coverage = serializers.FloatField()


class RehearsalRetrievalSerializer(serializers.Serializer):
    reason = serializers.CharField()
    excerpts = RehearsalExcerptSerializer(many=True)
    restricted_excerpts = serializers.IntegerField()


class RehearsalResultSerializer(serializers.Serializer):
    source = serializers.ChoiceField(choices=["explicit", "gap_case"])
    gap_case_id = serializers.UUIDField(allow_null=True)
    question = serializers.CharField()
    language = serializers.ChoiceField(choices=LANGUAGE_CHOICES)
    classification = serializers.ChoiceField(choices=["unchanged", "changed", "lost", "gained"])
    before = RehearsalRetrievalSerializer()
    after = RehearsalRetrievalSerializer()


class RehearsalResponseSerializer(serializers.Serializer):
    class RehearsalDocumentSerializer(serializers.Serializer):
        id = serializers.UUIDField()
        slug = serializers.CharField()
        title = serializers.CharField()
        state = serializers.ChoiceField(choices=["draft", "published", "archived"])
        version = serializers.IntegerField()
        has_unpublished_changes = serializers.BooleanField()

    class RehearsalCurrentSerializer(serializers.Serializer):
        revision_id = serializers.UUIDField()
        revision_number = serializers.IntegerField()
        content_hash = serializers.CharField()
        published_at = serializers.DateTimeField()

    class RehearsalDraftSerializer(serializers.Serializer):
        content_hash = serializers.CharField()
        language = serializers.ChoiceField(choices=LANGUAGE_CHOICES)
        topic = serializers.CharField()
        audience = serializers.ChoiceField(choices=Audience.choices)
        effective_from = serializers.DateField()
        effective_until = serializers.DateField(allow_null=True)
        section_count = serializers.IntegerField()

    class RehearsalAudienceImpactSerializer(serializers.Serializer):
        eligible_current = serializers.IntegerField(allow_null=True)
        eligible_draft = serializers.IntegerField()
        changed = serializers.IntegerField()

    class RehearsalSummarySerializer(serializers.Serializer):
        total = serializers.IntegerField()
        unchanged = serializers.IntegerField()
        changed = serializers.IntegerField()
        lost = serializers.IntegerField()
        gained = serializers.IntegerField()

    document = RehearsalDocumentSerializer()
    current = RehearsalCurrentSerializer(allow_null=True)
    draft = RehearsalDraftSerializer()
    audience_impact = RehearsalAudienceImpactSerializer()
    summary = RehearsalSummarySerializer()
    impacted_employees_count = serializers.IntegerField()
    results = RehearsalResultSerializer(many=True)
    scope = serializers.ChoiceField(choices=["extractive_retrieval_comparison"])
    not_legal_verification = serializers.BooleanField()


class GapCaseSerializer(serializers.ModelSerializer):
    resolution_kind = serializers.SerializerMethodField()
    policy_reference = serializers.SerializerMethodField()
    allowed_actions = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeGapCase
        fields = [
            "id",
            "employee",
            "legal_entity",
            "answer",
            "question",
            "details",
            "status",
            "version",
            "response",
            "resolution_kind",
            "policy_reference",
            "resolved_by",
            "resolved_at",
            "created_at",
            "updated_at",
            "allowed_actions",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.ChoiceField(choices=["individual_answer", "published_policy"]))
    def get_resolution_kind(self, obj):
        return "published_policy" if obj.published_revision_id else "individual_answer"

    @extend_schema_field(PolicyReferenceSerializer(allow_null=True))
    def get_policy_reference(self, obj):
        reference = present_policy_reference(obj, self.context["request"].user)
        return PolicyReferenceSerializer(reference).data if reference else None

    @extend_schema_field(serializers.ListField(child=serializers.ChoiceField(choices=["resolve"])))
    def get_allowed_actions(self, obj):
        user = self.context["request"].user
        return (
            ["resolve"] if obj.status == "open" and (user.role == "hr" or user.is_superuser) else []
        )
