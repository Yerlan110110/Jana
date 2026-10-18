import uuid

import pytest

from apps.identity.seed import seed_identity
from apps.knowledge.models import KnowledgeDocument
from apps.knowledge.presentation import present_answer
from apps.knowledge.seed import seed_knowledge
from apps.knowledge.services import ask_question

pytestmark = pytest.mark.django_db
PASSWORD = "Synthetic-country-password-73!"
LEAVE_QUESTION = "Сколько дней ежегодного отпуска мне положено?"
LEAVE_TITLE = "Ежегодный оплачиваемый отпуск: продолжительность и деление"


@pytest.fixture
def seeded_countries(db):
    employees = seed_identity(PASSWORD)
    seed_knowledge()
    return {employee.user.username: employee for employee in employees}


def ask(user, question):
    answer, _ = ask_question(user, question, "ru", uuid.uuid4())
    return present_answer(answer, user)


def cited_documents(result):
    return KnowledgeDocument.objects.filter(
        pk__in=[citation["document_id"] for citation in result["citations"]]
    )


def test_leave_days_answer_cites_kazakhstan_document(seeded_countries):
    result = ask(seeded_countries["employee.demo"].user, LEAVE_QUESTION)
    assert result["mode"] == "extractive"
    document = cited_documents(result).get(title=LEAVE_TITLE)
    assert document.legal_entity.code.startswith("SYN-KZ")
    assert "24 календарных дня" in " ".join(
        citation["text"] for citation in result["citations"]
    )


def test_leave_days_answer_cites_kyrgyzstan_document(seeded_countries):
    result = ask(seeded_countries["employee.kg.demo"].user, LEAVE_QUESTION)
    assert result["mode"] == "extractive"
    document = cited_documents(result).get(title=LEAVE_TITLE)
    assert document.legal_entity.code == "SYN-KG"
    citations_text = " ".join(citation["text"] for citation in result["citations"])
    assert "28 календарных дней" in citations_text
    assert "24 календарных дня" not in citations_text
    assert not cited_documents(result).filter(slug__endswith="leave-duration-kz").exists()


def test_leave_days_answer_cites_uzbekistan_document(seeded_countries):
    result = ask(seeded_countries["employee.uz.demo"].user, LEAVE_QUESTION)
    assert result["mode"] == "extractive"
    document = cited_documents(result).get(title=LEAVE_TITLE)
    assert document.legal_entity.code == "SYN-UZ"
    assert "21 календарный день" in " ".join(
        citation["text"] for citation in result["citations"]
    )


def test_salary_frequency_answer_uses_uzbekistan_half_month_rule(seeded_countries):
    result = ask(
        seeded_countries["employee.uz.demo"].user, "Как часто выплачивается зарплата?"
    )
    assert result["mode"] == "extractive"
    document = cited_documents(result).get(
        title="Сроки выплаты заработной платы и аванс"
    )
    assert document.legal_entity.code == "SYN-UZ"
    assert "не реже одного раза в каждые полмесяца" in " ".join(
        citation["text"] for citation in result["citations"]
    )
