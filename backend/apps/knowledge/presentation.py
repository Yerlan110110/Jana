from django.urls import reverse

from .models import AssistantAnswer, KnowledgeGapCase
from .selectors import accessible_chunks, policy_revision_for_case

MESSAGES = {
    "ru": {
        "generated_from_evidence": "AI выбрал предложения из доступных регламентов. Текст источника сохранен без пересказа.",
        "lexical_evidence": "Найдены выдержки из регламентов. Ответ показан без генерации AI.",
        "no_matching_policy": "В доступных регламентах нет подтвержденного ответа. Уточните вопрос или отправьте его HR.",
        "clarification_required": "Уточните тему и действие, например, как подать заявку на отпуск или аванс.",
        "unsafe_instruction": "Ассистент отвечает на вопросы по регламентам. Задайте вопрос о кадровом процессе или обратитесь к HR.",
        "source_no_longer_available": "Источник этого ответа больше недоступен. Задайте вопрос снова или обратитесь к HR.",
        "provider_not_configured": "Генерация AI не настроена. Повторите запрос после настройки сервиса или отправьте вопрос HR.",
        "provider_error": "Сервис генерации не ответил. Повторите запрос позже или отправьте вопрос HR.",
        "invalid_provider_output": "Не удалось подтвердить ответ AI по источникам. Повторите запрос или отправьте вопрос HR.",
    },
    "kk": {
        "generated_from_evidence": "AI қолжетімді ережелерден сөйлемдерді таңдады. Дереккөз мәтіні өзгеріссіз сақталды.",
        "lexical_evidence": "Ережелерден үзінділер табылды. Жауап AI генерациясынсыз көрсетілді.",
        "no_matching_policy": "Қолжетімді ережелерде расталған жауап жоқ. Сұрақты нақтылаңыз немесе HR бөліміне жіберіңіз.",
        "clarification_required": "Тақырып пен әрекетті нақтылаңыз. Мысалы, демалысқа немесе авансқа өтініш беру тәртібін сұраңыз.",
        "unsafe_instruction": "Ассистент ережелер бойынша сұрақтарға жауап береді. Кадрлық рәсім туралы сұраңыз немесе HR бөліміне жүгініңіз.",
        "source_no_longer_available": "Бұл жауаптың дереккөзі енді қолжетімсіз. Сұрақты қайта қойыңыз немесе HR бөліміне жүгініңіз.",
        "provider_not_configured": "AI генерациясы бапталмаған. Сервис бапталған соң қайталаңыз немесе сұрақты HR бөліміне жіберіңіз.",
        "provider_error": "Генерация сервисі жауап бермеді. Кейін қайталаңыз немесе сұрақты HR бөліміне жіберіңіз.",
        "invalid_provider_output": "AI жауабын дереккөздермен растау мүмкін болмады. Қайталаңыз немесе сұрақты HR бөліміне жіберіңіз.",
    },
}


def present_citation(chunk):
    revision = chunk.revision
    return {
        "chunk_id": chunk.id,
        "document_id": revision.document_id,
        "revision_id": revision.id,
        "revision_number": revision.number,
        "title": revision.title,
        "heading": chunk.heading,
        "locator": chunk.locator,
        "text": chunk.text,
        "url": reverse("knowledge-citation", kwargs={"pk": chunk.id}),
        "published_at": revision.published_at,
        "effective_from": revision.effective_from,
        "effective_until": revision.effective_until,
        "language": revision.language,
        "is_synthetic": revision.is_synthetic,
        "is_current": revision.document.current_revision_id == revision.id,
        "content_hash": chunk.content_hash,
    }


def present_answer(answer, user):
    chunk_ids = {support["chunk_id"] for claim in answer.claims for support in claim["supports"]}
    chunks = list(accessible_chunks(user).filter(pk__in=chunk_ids))
    visible_ids = {str(chunk.id) for chunk in chunks}
    mode, reason, claims = answer.mode, answer.reason, answer.claims
    evidence_status = "not_applicable"
    if chunk_ids:
        if visible_ids != chunk_ids:
            mode, reason, claims, chunks = (
                AssistantAnswer.Mode.INSUFFICIENT,
                "source_no_longer_available",
                [],
                [],
            )
            evidence_status = "unavailable"
        else:
            evidence_status = (
                "current"
                if all(
                    chunk.revision.document.current_revision_id == chunk.revision_id
                    for chunk in chunks
                )
                else "superseded"
            )
    case_id = KnowledgeGapCase.objects.filter(answer=answer).values_list("id", flat=True).first()
    return {
        "id": answer.id,
        "client_message_id": answer.client_message_id,
        "question": answer.question,
        "language": answer.language,
        "mode": mode,
        "answer_strategy": {
            "generated": "source_bound_selection",
            "extractive": "ranked_excerpts",
            "insufficient_evidence": "refusal",
            "provider_unavailable": "unavailable",
        }[mode],
        "reason": reason,
        "message": MESSAGES[answer.language][reason],
        "claims": claims,
        "citations": [present_citation(chunk) for chunk in chunks],
        "evidence_status": evidence_status,
        "provider": answer.provider,
        "model": answer.model,
        "case_id": case_id,
        "allowed_actions": ["ask_again", "open_hr_case" if case_id else "escalate_to_hr"],
        "created_at": answer.created_at,
    }


def present_policy_reference(case, user):
    if case.published_revision_id is None:
        return None
    revision = policy_revision_for_case(user, case, case.published_revision_id)
    return {
        "revision_id": case.published_revision_id,
        "state": "unavailable"
        if revision is None
        else ("current" if revision.document.current_revision_id == revision.pk else "superseded"),
        "revision": revision,
        "url": reverse("knowledge-gap-policy-reference", kwargs={"pk": case.pk}),
    }
