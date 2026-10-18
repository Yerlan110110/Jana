import pytest

from apps.knowledge.evaluation import evaluate_knowledge
from apps.knowledge.models import KnowledgeDocument, KnowledgeGapCase
from apps.knowledge.seed import seed_knowledge
from apps.knowledge.services import update_document

pytestmark = pytest.mark.django_db


def test_seed_is_populated_idempotent_and_preserves_hr_edits(employees):
    created = seed_knowledge()
    assert len(created) == 20
    assert KnowledgeDocument.objects.filter(state="archived").count() == 1
    assert KnowledgeDocument.objects.filter(state="draft").count() == 1
    assert KnowledgeDocument.objects.filter(language="kk").count() == 2
    assert KnowledgeGapCase.objects.filter(status="open").count() == 2
    assert KnowledgeGapCase.objects.filter(status="resolved").count() == 1
    document = KnowledgeDocument.objects.get(slug="syn-kz-demo-leave")
    document = update_document(
        employees["hr"].user,
        document.id,
        document.version,
        {"summary": "HR сохранил собственную правку черновика."},
    )
    assert seed_knowledge() == []
    document.refresh_from_db()
    assert document.summary == "HR сохранил собственную правку черновика."
    assert KnowledgeDocument.objects.count() == 20


def test_machine_readable_knowledge_regression_cases(employees):
    seed_knowledge()
    result = evaluate_knowledge(
        {"employee": employees["employee"].user, "hr": employees["hr"].user}
    )
    failures = [case for case in result["cases"] if not case["passed"]]
    assert result["passed"] == result["total"], failures
