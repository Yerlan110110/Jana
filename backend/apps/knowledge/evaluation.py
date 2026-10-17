import hashlib
import json
import uuid
from importlib.metadata import version
from pathlib import Path

from django.db import connection
from django.utils import timezone

from .presentation import present_answer
from .services import ask_question


def evaluate_knowledge(users):
    module_path = Path(__file__).parent
    dataset = json.loads((module_path / "data" / "evaluation.json").read_text())
    rows = []
    for case in dataset["cases"]:
        user = users[case["role"]]
        answer, _ = ask_question(user, case["question"], case["language"], uuid.uuid4())
        result = present_answer(answer, user)
        failures = []
        if result["mode"] != case["expected_mode"]:
            failures.append(f"mode={result['mode']}")
        if "expected_reason" in case and result["reason"] != case["expected_reason"]:
            failures.append(f"reason={result['reason']}")
        if case.get("expected_text") and case["expected_text"] not in " ".join(
            claim["text"] for claim in result["claims"]
        ):
            failures.append("required_source_statement_missing")
        if "expected_topic" in case:
            from .models import KnowledgeChunk

            topics = set(
                KnowledgeChunk.objects.filter(
                    pk__in=[citation["chunk_id"] for citation in result["citations"]]
                ).values_list("revision__topic", flat=True)
            )
            if topics != {case["expected_topic"]}:
                failures.append(f"topics={sorted(topics)}")
        if case.get("forbidden_text") and case["forbidden_text"] in json.dumps(
            result, ensure_ascii=False, default=str
        ):
            failures.append("restricted_text_disclosed")
        if case["expected_mode"] == "insufficient_evidence" and (
            result["claims"] or result["citations"]
        ):
            failures.append("refusal_contains_claims_or_citations")
        rows.append(
            {
                "id": case["id"],
                "kind": case["kind"],
                "passed": not failures,
                "mode": result["mode"],
                "reason": result["reason"],
                "failures": failures,
            }
        )
    return {
        "dataset": dataset["dataset"],
        "scope": dataset["scope"],
        "calibration": "The lexical gate and stop words were tuned against this synthetic regression set. These are not held-out accuracy results.",
        "generated_at": timezone.now().isoformat(),
        "database_vendor": connection.vendor,
        "package_versions": {
            name: version(name) for name in ("Django", "rank-bm25", "snowballstemmer", "openai")
        },
        "input_hashes": {
            name: hashlib.sha256((module_path / name).read_bytes()).hexdigest()
            for name in ("data/policies.json", "data/evaluation.json", "retrieval.py")
        },
        "total": len(rows),
        "passed": sum(row["passed"] for row in rows),
        "cases": rows,
    }
