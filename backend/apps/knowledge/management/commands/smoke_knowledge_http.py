import json
import uuid
from pathlib import Path
from urllib.parse import urlparse

import httpx
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Verify the synthetic knowledge journey over real loopback HTTP sessions without printing credentials."

    def add_arguments(self, parser):
        parser.add_argument("--base-url", default="http://127.0.0.1:8000")
        parser.add_argument("--credentials-file", required=True)
        parser.add_argument("--output")

    def handle(self, *args, **options):
        base_url = options["base_url"].rstrip("/")
        parsed = urlparse(base_url)
        if (
            parsed.scheme != "http"
            or parsed.hostname not in {"127.0.0.1", "localhost"}
            or parsed.username
            or parsed.password
        ):
            raise CommandError("Use an HTTP loopback server for this synthetic local check.")
        accounts = {
            account["username"]: account
            for account in json.loads(Path(options["credentials_file"]).read_text())["accounts"]
        }
        checks = []

        def require(condition, check):
            if not condition:
                raise CommandError(f"Knowledge HTTP check failed: {check}")
            checks.append({"check": check, "passed": True})

        with httpx.Client(
            base_url=base_url, timeout=30, follow_redirects=False, trust_env=False
        ) as client:

            def login(username):
                account = accounts[username]
                require(bool(account["password"]), f"credential_available:{username}")
                token = client.get("/api/v1/auth/csrf/")
                require(token.status_code == 200, f"csrf:{username}")
                response = client.post(
                    "/api/v1/auth/login/",
                    json={"username": username, "password": account["password"]},
                    headers={"X-CSRFToken": token.json()["csrf_token"], "Origin": base_url},
                )
                require(response.status_code == 200, f"login:{username}")
                client.headers["X-CSRFToken"] = response.json()["csrf_token"]
                client.headers["Origin"] = base_url

            def logout():
                require(client.post("/api/v1/auth/logout/").status_code == 204, "logout")
                client.headers.pop("X-CSRFToken", None)

            login("employee.demo")
            response = client.post(
                "/api/v1/assistant/answers/",
                json={
                    "question": "Как подать заявку на отпуск?",
                    "client_message_id": str(uuid.uuid4()),
                },
            )
            require(response.status_code == 201, "ask_supported_question")
            answer = response.json()
            require(
                answer["mode"] == "extractive" and answer["answer_strategy"] == "ranked_excerpts",
                "explicit_no_key_mode",
            )
            require(
                bool(answer["claims"]) and bool(answer["citations"]),
                "supported_answer_has_evidence",
            )
            citation = client.get(answer["citations"][0]["url"])
            require(
                citation.status_code == 200
                and citation.json()["text"] == answer["citations"][0]["text"],
                "citation_resolves_exact_excerpt",
            )
            unknown = client.post(
                "/api/v1/assistant/answers/",
                json={
                    "question": "Как получить корпоративную ипотеку?",
                    "client_message_id": str(uuid.uuid4()),
                },
            )
            require(
                unknown.status_code == 201 and unknown.json()["mode"] == "insufficient_evidence",
                "unknown_question_refused",
            )
            restricted = client.post(
                "/api/v1/assistant/answers/",
                json={
                    "question": "Как выполняется контроль закрытия расчетного периода?",
                    "client_message_id": str(uuid.uuid4()),
                },
            )
            require(
                restricted.status_code == 201
                and restricted.json()["mode"] == "insufficient_evidence"
                and not restricted.json()["citations"],
                "hr_source_excluded",
            )
            payload = {
                "answer_id": unknown.json()["id"],
                "details": "Синтетический вопрос из проверки HTTP.",
            }
            key = str(uuid.uuid4())
            created = client.post(
                "/api/v1/knowledge/gaps/", json=payload, headers={"Idempotency-Key": key}
            )
            require(created.status_code == 201, "explicit_hr_case_created")
            case = created.json()
            replay = client.post(
                "/api/v1/knowledge/gaps/", json=payload, headers={"Idempotency-Key": key}
            )
            require(
                replay.status_code == 201 and replay.json()["id"] == case["id"], "hr_case_replay"
            )
            logout()
            login("manager.demo")
            require(
                client.get(f"/api/v1/knowledge/gaps/{case['id']}/").status_code == 404,
                "manager_cannot_open_private_hr_case",
            )
            logout()
            login("hr.demo")
            require(
                client.get(f"/api/v1/knowledge/gaps/{case['id']}/").status_code == 200,
                "entity_hr_can_open_case",
            )
            resolved = client.post(
                f"/api/v1/knowledge/gaps/{case['id']}/resolve/",
                json={
                    "expected_version": case["version"],
                    "response": "Демонстрационный ответ HR. Эта программа в базе не установлена.",
                },
                headers={"Idempotency-Key": str(uuid.uuid4())},
            )
            require(
                resolved.status_code == 200 and resolved.json()["status"] == "resolved",
                "hr_response_persisted",
            )
            logout()
            login("employee.demo")
            final = client.get(f"/api/v1/knowledge/gaps/{case['id']}/")
            require(
                final.status_code == 200 and final.json()["status"] == "resolved",
                "employee_reads_hr_response",
            )
            notices = client.get("/api/v1/notifications/?kind=knowledge_gap_resolved")
            require(
                notices.status_code == 200
                and any(item["target_id"] == case["id"] for item in notices.json()["results"]),
                "employee_receives_notification",
            )
            logout()
        report = {
            "check": "knowledge_http_journey",
            "scope": "Synthetic loopback HTTP with real Django session cookies and CSRF. No frontend or live model provider.",
            "passed": len(checks),
            "total": len(checks),
            "checks": checks,
        }
        encoded = json.dumps(report, ensure_ascii=False, indent=2)
        if options["output"]:
            Path(options["output"]).write_text(encoded + "\n")
        self.stdout.write(encoded)
