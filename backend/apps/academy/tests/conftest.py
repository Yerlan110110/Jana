from copy import deepcopy

import pytest

from apps.academy import services


@pytest.fixture
def course_draft():
    return {
        "title": "Синтетический курс по проверке сведений",
        "title_kk": "Мәліметтерді тексеру туралы оқу курсы",
        "summary": "Учебная ситуация о подтверждённых данных и истории.",
        "summary_kk": "Расталған деректер мен тарих туралы оқу жағдайы.",
        "category": "hr",
        "content_language": "ru",
        "passing_percent": 80,
        "max_attempts": 3,
        "estimated_minutes": 8,
        "lessons": [
            {
                "id": "source",
                "title": "Источник",
                "body_markdown": "Проверьте источник и дату обновления сведений.",
                "required": True,
            },
            {
                "id": "history",
                "title": "История",
                "body_markdown": "Сохраните исходную запись и объяснение изменения.",
                "required": True,
            },
        ],
        "questions": [
            {
                "id": "q1",
                "prompt": "Что проверить у значения?",
                "options": [{"id": "a", "text": "Источник"}, {"id": "b", "text": "Цвет"}],
                "correct_option_id": "a",
                "explanation": "Источник подтверждает происхождение.",
            },
            {
                "id": "q2",
                "prompt": "Нужно ли сохранять историю?",
                "options": [{"id": "a", "text": "Да"}, {"id": "b", "text": "Нет"}],
                "correct_option_id": "a",
                "explanation": "История объясняет изменение.",
            },
            {
                "id": "q3",
                "prompt": "Кто исправляет импортированный факт?",
                "options": [
                    {"id": "a", "text": "Владелец источника"},
                    {"id": "b", "text": "Любой читатель"},
                ],
                "correct_option_id": "a",
                "explanation": "Источник управляет фактом.",
            },
        ],
    }


@pytest.fixture
def published_course(employees, course_draft):
    user = employees["hr"].user
    course = services.create_course(user, "synthetic-hr", deepcopy(course_draft))
    return services.publish_course(user, course.pk, course.version)


@pytest.fixture
def enrollment(employees, published_course):
    return services.assign(
        employees["hr"].user, published_course.published_version_id, employees["employee"].pk
    )


def answer_payload(*, correct=True):
    return [
        {"question_id": question, "selected_option_id": "a" if correct else "b"}
        for question in ["q1", "q2", "q3"]
    ]


def finish_material(employee, enrollment):
    for lesson in enrollment.course_version.lessons:
        enrollment = services.complete_lesson(
            employee.user, enrollment.pk, enrollment.version, lesson["id"]
        )
    return enrollment
