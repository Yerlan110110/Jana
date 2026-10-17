import uuid
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.knowledge.services import create_document, publish_document


@pytest.fixture
def make_policy(employees):
    def create(
        *,
        audience="all",
        department=None,
        title="Порядок отпуска",
        topic="leave",
        text=None,
        effective_from=None,
        effective_until=None,
        publish=True,
        actor=None,
    ):
        actor = actor or employees["hr"]
        document = create_document(
            actor.user,
            {
                "slug": f"policy-{uuid.uuid4().hex}",
                "title": title,
                "summary": "Синтетический регламент для проверки поведения портала.",
                "language": "ru",
                "topic": topic,
                "owner": actor,
                "legal_entity": actor.legal_entity,
                "department": department,
                "audience": audience,
                "draft_sections": [
                    {
                        "heading": title,
                        "text": text
                        or "Чтобы подать заявку на отпуск, укажите даты начала и окончания. Заявку на отпуск рассматривает руководитель, затем HR. Ассистент не согласовывает отпуск.",
                    }
                ],
                "effective_from": effective_from or timezone.localdate() - timedelta(days=1),
                "effective_until": effective_until,
                "is_synthetic": True,
            },
        )
        return publish_document(actor.user, document.id, document.version) if publish else document

    return create


@pytest.fixture
def question_payload():
    return {
        "question": "Как подать заявку на отпуск?",
        "language": "ru",
        "client_message_id": str(uuid.uuid4()),
    }


@pytest.fixture(autouse=True)
def local_generation(monkeypatch):
    monkeypatch.setenv("KNOWLEDGE_GENERATION_PROVIDER", "extractive")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
