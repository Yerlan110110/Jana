import json
from datetime import timedelta
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from django.db import transaction
from django.utils import timezone

from apps.identity.models import Employee

from .models import KnowledgeDocument
from .services import (
    archive_document,
    ask_question,
    create_document,
    escalate_answer,
    publish_document,
    resolve_gap_case,
    update_document,
)


def entity_country(legal_entity):
    return legal_entity.code.removeprefix("SYN-").split("-")[0]


@transaction.atomic
def seed_knowledge():
    dataset = json.loads((Path(__file__).parent / "data" / "policies.json").read_text())
    owners = (
        Employee.objects.filter(
            is_active=True,
            user__is_active=True,
            user__role="hr",
        )
        .select_related("user", "legal_entity", "department")
        .order_by("legal_entity__code", "external_id")
    )
    seen_entities = set()
    created = []
    for owner in owners:
        if owner.legal_entity_id in seen_entities:
            continue
        seen_entities.add(owner.legal_entity_id)
        for policy in dataset["documents"]:
            if policy.get("country") and policy["country"] != entity_country(owner.legal_entity):
                continue
            slug = f"{owner.legal_entity.code.lower()}-demo-{policy['slug']}"
            if KnowledgeDocument.objects.filter(slug=slug).exists():
                continue
            department = None
            if policy.get("department_only"):
                department = owner.legal_entity.departments.filter(code__iexact="warehouse").first()
                if department is None:
                    continue
            effective_from = timezone.localdate() - timedelta(days=30)
            if policy.get("state") == "future":
                effective_from = timezone.localdate() + timedelta(days=365)
            document = create_document(
                owner.user,
                {
                    "slug": slug,
                    "title": policy["title"],
                    "summary": policy["summary"],
                    "language": policy["language"],
                    "topic": policy["topic"],
                    "owner": owner,
                    "legal_entity": owner.legal_entity,
                    "department": department,
                    "audience": policy["audience"],
                    "draft_sections": policy["sections"],
                    "effective_from": effective_from,
                    "is_synthetic": True,
                },
            )
            if policy.get("state") != "draft":
                document = publish_document(owner.user, document.id, document.version)
                if policy.get("state") == "archived":
                    document = archive_document(owner.user, document.id, document.version)
            created.append(document)
        staff = list(
            Employee.objects.filter(
                legal_entity=owner.legal_entity,
                is_active=True,
                user__is_active=True,
                user__role="employee",
            )
            .select_related("user")
            .order_by("external_id")[:4]
        )
        questions = [
            ("Есть ли программа корпоративной ипотеки?", False),
            ("Можно ли получить семейную медицинскую страховку?", True),
            ("Предусмотрена ли компенсация дошкольного образования?", False),
            ("Можно ли перенести часть отпуска на следующий год?", False),
        ]
        for employee, (question, resolved) in zip(staff, questions, strict=False):
            message_id = uuid5(
                NAMESPACE_URL,
                f"https://github.com/Yerlan110110/Jana/synthetic/knowledge-gap-v1/{employee.external_id}",
            )
            answer, _ = ask_question(employee.user, question, "ru", message_id)
            case, case_created = escalate_answer(
                employee.user,
                answer.id,
                "Демонстрационное обращение сотрудника. Реальные персональные данные не используются.",
            )
            if resolved and case_created:
                resolve_gap_case(
                    owner.user,
                    case.id,
                    case.version,
                    "В демонстрационной базе такая программа не установлена. Для реального ответа требуется утвержденный регламент владельца программы.",
                )
    for document in created:
        if document.slug.endswith("-demo-leave"):
            update_document(
                document.owner.user,
                document.id,
                document.version,
                {
                    "draft_sections": [
                        *document.draft_sections,
                        {
                            "heading": "Перенос отпуска",
                            "text": (
                                "Синтетическое дополнение для репетиции публикации. "
                                "С письменного согласия руководителя часть отпуска свыше "
                                "четырнадцати календарных дней можно перенести на следующий "
                                "год. Заявку на перенос отпуска сотрудник подает через портал "
                                "до 1 декабря текущего года."
                            ),
                        },
                    ]
                },
            )
    return created
