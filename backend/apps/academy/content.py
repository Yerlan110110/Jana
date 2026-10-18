from rest_framework import serializers

from apps.core.serializers import StrictSerializer

CATEGORIES = [
    ("hr", "Кадровые действия"),
    ("logistics", "Логистические данные"),
    ("communication", "Общение"),
    ("information_security", "Доступ и информация"),
    ("team", "Руководитель и HR"),
    ("knowledge", "Регламенты и знания"),
]


class LessonSerializer(StrictSerializer):
    id = serializers.SlugField(max_length=80)
    title = serializers.CharField(max_length=200)
    body_markdown = serializers.CharField(max_length=20000)
    required = serializers.BooleanField(default=True)


class OptionSerializer(StrictSerializer):
    id = serializers.SlugField(max_length=40)
    text = serializers.CharField(max_length=2000)


class QuestionSerializer(StrictSerializer):
    id = serializers.SlugField(max_length=80)
    prompt = serializers.CharField(max_length=2000)
    options = OptionSerializer(many=True, min_length=2, max_length=8)

    def validate_options(self, values):
        if len({option["id"] for option in values}) != len(values):
            raise serializers.ValidationError(
                "Option identifiers must be unique within a question."
            )
        return values


class AuthorQuestionSerializer(QuestionSerializer):
    correct_option_id = serializers.SlugField(max_length=40)
    explanation = serializers.CharField(max_length=3000)

    def validate(self, values):
        if values["correct_option_id"] not in {option["id"] for option in values["options"]}:
            raise serializers.ValidationError(
                {"correct_option_id": "Choose an option from this question."}
            )
        return values


class CourseDraftSerializer(StrictSerializer):
    title = serializers.CharField(max_length=200)
    title_kk = serializers.CharField(max_length=200, allow_blank=True, default="")
    summary = serializers.CharField(max_length=2000)
    summary_kk = serializers.CharField(max_length=2000, allow_blank=True, default="")
    category = serializers.ChoiceField(choices=CATEGORIES)
    content_language = serializers.ChoiceField(
        choices=[("ru", "Русский"), ("kk", "Қазақша")], default="ru"
    )
    lessons = LessonSerializer(many=True, max_length=50, default=list)
    questions = AuthorQuestionSerializer(many=True, max_length=100, default=list)
    passing_percent = serializers.IntegerField(min_value=1, max_value=100, default=80)
    max_attempts = serializers.IntegerField(min_value=1, max_value=100, allow_null=True, default=3)
    estimated_minutes = serializers.IntegerField(
        min_value=1, max_value=600, allow_null=True, default=None
    )

    def validate(self, values):
        for field in ("lessons", "questions"):
            items = values[field]
            if len({item["id"] for item in items}) != len(items):
                raise serializers.ValidationError(
                    {field: "Identifiers must be unique in this course revision."}
                )
        return values


def validate_draft(draft, *, publishing=False):
    serializer = CourseDraftSerializer(data=draft)
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    if publishing:
        if not values["lessons"] or not any(lesson["required"] for lesson in values["lessons"]):
            raise serializers.ValidationError(
                {"lessons": "Добавьте хотя бы один обязательный материал."}
            )
        if not values["questions"]:
            raise serializers.ValidationError(
                {"questions": "Добавьте хотя бы один вопрос для проверки знаний."}
            )
    return values
