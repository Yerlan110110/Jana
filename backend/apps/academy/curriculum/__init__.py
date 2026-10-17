from copy import deepcopy
from textwrap import dedent

from .communication import COURSES as COMMUNICATION
from .hr import COURSES as HR
from .information_security import COURSES as INFORMATION_SECURITY
from .knowledge import COURSES as KNOWLEDGE
from .logistics import COURSES as LOGISTICS
from .team import COURSES as TEAM

GROUPS = [
    ("hr", HR),
    ("logistics", LOGISTICS),
    ("communication", COMMUNICATION),
    ("information_security", INFORMATION_SECURITY),
    ("team", TEAM),
    ("knowledge", KNOWLEDGE),
]


def curriculum():
    result = []
    for category, courses in GROUPS:
        for item in courses:
            slug = item["code"].lower()
            questions = []
            for index, (prompt, correct, wrong_one, wrong_two, explanation) in enumerate(
                item["questions"]
            ):
                offset = (sum(map(ord, slug)) + index) % 3
                variants = [correct, wrong_one, wrong_two]
                rotated = variants[-offset:] + variants[:-offset] if offset else variants
                questions.append(
                    {
                        "id": f"{slug}-q-{index + 1}",
                        "prompt": prompt,
                        "options": [
                            {"id": chr(97 + choice), "text": text}
                            for choice, text in enumerate(rotated)
                        ],
                        "correct_option_id": chr(97 + offset),
                        "explanation": explanation,
                    }
                )
            result.append(
                {
                    "code": item["code"],
                    "slug": slug,
                    "draft": {
                        "title": item["title"],
                        "title_kk": item["title_kk"],
                        "summary": f"Демонстрационный курс. {item['summary']}",
                        "summary_kk": "",
                        "category": category,
                        "content_language": "ru",
                        "passing_percent": 80,
                        "max_attempts": 3,
                        "estimated_minutes": 8,
                        "lessons": [
                            {
                                "id": f"{slug}-lesson-{index + 1}",
                                "title": title,
                                "required": True,
                                "body_markdown": "Демонстрационный учебный материал. Все ситуации и правила проекта синтетические.\n\n"
                                + dedent(body).strip(),
                            }
                            for index, (title, body) in enumerate(item["lessons"])
                        ],
                        "questions": questions,
                    },
                }
            )
    return deepcopy(result)
