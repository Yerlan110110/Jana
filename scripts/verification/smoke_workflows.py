#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from http.cookiejar import CookieJar
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import (
    HTTPCookieProcessor,
    HTTPRedirectHandler,
    ProxyHandler,
    Request,
    build_opener,
)

API = "/api/v1/"
MAX_RESPONSE_BYTES = 4 * 1024 * 1024


class SmokeFailure(Exception):
    def __init__(self, check: str, recovery: str = "Inspect this check and the local API logs."):
        self.check = check
        self.recovery = recovery
        super().__init__(check)


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def loopback_url(value: str) -> str:
    try:
        parsed = urlsplit(value)
        port = parsed.port if parsed.port is not None else 80
    except ValueError as error:
        raise SmokeFailure("loopback_target_required") from error
    if (
        parsed.scheme != "http"
        or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
        or any(ord(character) <= 32 for character in value)
        or not 1 <= port <= 65535
    ):
        raise SmokeFailure(
            "loopback_target_required",
            "Use an HTTP origin on 127.0.0.1, localhost, or [::1] without a path or credentials.",
        )
    host = "[::1]" if parsed.hostname == "::1" else "127.0.0.1"
    return f"http://{host}:{port}"


def identifier(value: Any) -> str:
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError) as error:
        raise SmokeFailure("api_resource_identifier_is_uuid") from error


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


@dataclass(frozen=True)
class HTTPResult:
    status: int
    body: dict[str, Any] = field(repr=False)
    headers: dict[str, str] = field(repr=False)
    json_object: bool = False


class HTTPSession:
    def __init__(self, base_url: str, timeout: float):
        self.base_url = base_url
        self.timeout = timeout
        self.csrf_token = ""
        self.cookies = CookieJar()
        self.opener = build_opener(
            ProxyHandler({}), HTTPCookieProcessor(self.cookies), NoRedirect()
        )
        self.employee: dict[str, Any] = {}
        self.role = ""
        self.authenticated = False
        self.request_count = 0

    def target(self, path: str) -> str:
        parsed = urlsplit(path)
        origin = urlsplit(self.base_url)
        if (
            (parsed.scheme and parsed.scheme != origin.scheme)
            or (parsed.netloc and parsed.netloc != origin.netloc)
            or parsed.username is not None
            or parsed.password is not None
            or parsed.fragment
            or not parsed.path.startswith(API)
            or any(ord(character) <= 32 for character in path)
        ):
            raise SmokeFailure("api_link_stays_on_original_loopback_origin")
        return urlunsplit((origin.scheme, origin.netloc, parsed.path, parsed.query, ""))

    def request(
        self,
        method: str,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        key: str | None = None,
        csrf: bool = True,
    ) -> HTTPResult:
        headers = {"Accept": "application/json"}
        if method not in {"GET", "HEAD", "OPTIONS"}:
            headers["Origin"] = self.base_url
            if csrf and self.csrf_token:
                headers["X-CSRFToken"] = self.csrf_token
        if key is not None:
            headers["Idempotency-Key"] = key
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        request = Request(self.target(path), data=data, headers=headers, method=method)
        self.request_count += 1
        try:
            try:
                response = self.opener.open(request, timeout=self.timeout)
            except HTTPError as error:
                response = error
            with response:
                raw = response.read(MAX_RESPONSE_BYTES + 1)
                status = response.status
                response_headers = {key.lower(): value for key, value in response.headers.items()}
        except (URLError, TimeoutError, OSError) as error:
            raise SmokeFailure(
                "http_transport_available",
                "Start the loopback API and check its local logs, then use a new run.",
            ) from error
        if len(raw) > MAX_RESPONSE_BYTES:
            raise SmokeFailure("http_response_within_size_limit")
        try:
            parsed = json.loads(raw) if raw else None
        except (ValueError, UnicodeDecodeError):
            parsed = None
        return HTTPResult(
            status,
            parsed if isinstance(parsed, dict) else {},
            response_headers,
            isinstance(parsed, dict),
        )


@dataclass
class Report:
    run_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    started_at: str = field(default_factory=utc_now)
    checks: list[dict[str, Any]] = field(default_factory=list)
    artifacts: dict[str, Any] = field(default_factory=lambda: {"requests": [], "exports": []})
    observations: dict[str, Any] = field(default_factory=dict)
    failure: dict[str, str] | None = None

    def require(self, condition: bool, check: str, **evidence: Any) -> None:
        self.checks.append({"check": check, "passed": bool(condition), **evidence})
        if not condition:
            raise SmokeFailure(check)

    def document(self, sessions: dict[str, HTTPSession]) -> dict[str, Any]:
        return {
            "schema_version": 1,
            "check": "workflow_http_journey",
            "run_id": self.run_id,
            "synthetic": True,
            "outcome": "failed" if self.failure else "passed",
            "started_at": self.started_at,
            "finished_at": utc_now(),
            "scope": "Real loopback HTTP, independent cookie sessions, CSRF, and persisted API state.",
            "excludes": [
                "rendered_frontend",
                "live_ai",
                "real_1c",
                "real_documentolog",
                "payments",
                "signatures",
            ],
            "http_request_count": sum(session.request_count for session in sessions.values()),
            "passed": sum(item["passed"] for item in self.checks),
            "total": len(self.checks),
            "failure": self.failure,
            "checks": self.checks,
            "artifacts": self.artifacts,
            "observations": self.observations,
        }


class WorkflowSmoke:
    def __init__(self, args: argparse.Namespace, report: Report):
        self.args = args
        self.report = report
        self.base_url = loopback_url(args.base_url)
        self.sessions: dict[str, HTTPSession] = {}
        self.approved: list[dict[str, Any]] = []
        self.answer_sentinel = f"AUTHOR_ONLY_{report.run_id}"

    def api(
        self,
        check: str,
        actor: str,
        method: str,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        key: str | None = None,
        expected: int | tuple[int, ...] = 200,
        csrf: bool = True,
        expect_json: bool = True,
    ) -> HTTPResult:
        response = self.sessions[actor].request(method, path, body=body, key=key, csrf=csrf)
        statuses = (expected,) if isinstance(expected, int) else expected
        self.report.require(
            response.status in statuses,
            check,
            http_status=response.status,
            expected_status=list(statuses),
        )
        if expect_json and response.status != 204:
            self.report.require(response.json_object, f"{check}.json_object")
        return response

    def command(
        self, check: str, actor: str, path: str, body: dict[str, Any], **kwargs
    ) -> HTTPResult:
        return self.api(
            check,
            actor,
            "POST",
            path,
            body=body,
            key=kwargs.pop("key", str(uuid.uuid4())),
            **kwargs,
        )

    def all_items(self, actor: str, resource: str, **query: Any) -> list[dict[str, Any]]:
        path = f"{API}{resource}/?{urlencode({'page_size': 100, **query})}"
        found: list[dict[str, Any]] = []
        seen: set[str] = set()
        total = None
        for page in range(1, 251):
            self.report.require(path not in seen, f"{resource}.pagination_advances")
            seen.add(path)
            body = self.api(f"{resource}.page.{page}", actor, "GET", path).body
            self.report.require(
                type(body.get("count")) is int and isinstance(body.get("results"), list),
                f"{resource}.paginated_shape",
            )
            total = body["count"] if total is None else total
            self.report.require(body["count"] == total, f"{resource}.stable_page_count")
            self.report.require(
                all(isinstance(item, dict) for item in body["results"]), f"{resource}.object_rows"
            )
            found.extend(body["results"])
            next_page = body.get("next")
            if next_page is None:
                self.report.require(len(found) == total, f"{resource}.complete_pagination")
                return found
            self.report.require(isinstance(next_page, str), f"{resource}.next_link_shape")
            path = next_page
        raise SmokeFailure("pagination_limit_reached")

    def login(self, actor: str, username: str, account: dict[str, Any]) -> None:
        session = HTTPSession(self.base_url, self.args.request_timeout)
        self.sessions[actor] = session
        self.report.require(
            isinstance(account.get("password"), str) and bool(account["password"]),
            f"{actor}.synthetic_credential_available",
        )
        token = self.api(f"{actor}.csrf_bootstrap", actor, "GET", f"{API}auth/csrf/").body
        session.csrf_token = token.get("csrf_token", "")
        self.report.require(
            isinstance(session.csrf_token, str) and bool(session.csrf_token),
            f"{actor}.csrf_token_present",
        )
        payload = {"username": username, "password": account["password"]}
        if actor == "employee":
            self.api(
                "anonymous_session_denied", actor, "GET", f"{API}auth/me/", expected=(401, 403)
            )
            self.api(
                "login_without_csrf_denied",
                actor,
                "POST",
                f"{API}auth/login/",
                body=payload,
                csrf=False,
                expected=403,
                expect_json=False,
            )
        response = self.api(
            f"{actor}.login", actor, "POST", f"{API}auth/login/", body=payload, expected=(200, 429)
        )
        if response.status == 429:
            retry = response.headers.get("retry-after", "")
            self.report.require(
                retry.isdigit() and 0 < int(retry) <= 65, f"{actor}.bounded_login_retry"
            )
            deadline = time.monotonic() + int(retry)
            while time.monotonic() < deadline:
                time.sleep(min(30, max(0, deadline - time.monotonic())))
            response = self.api(
                f"{actor}.login_after_rate_limit", actor, "POST", f"{API}auth/login/", body=payload
            )
        self.report.require(response.status == 200, f"{actor}.authenticated")
        session.authenticated = True
        session.csrf_token = response.body.get("csrf_token", "")
        self.report.require(bool(session.csrf_token), f"{actor}.post_login_csrf_present")
        profile = self.api(f"{actor}.persisted_session", actor, "GET", f"{API}auth/me/").body
        employee = profile.get("employee")
        self.report.require(isinstance(employee, dict), f"{actor}.employee_profile_present")
        self.report.require(
            employee.get("external_id") == f"SYN-{username}"
            and profile.get("user", {}).get("username") == username,
            f"{actor}.server_confirms_synthetic_identity",
        )
        expected_role = {
            "employee": "employee",
            "manager": "manager",
            "hr": "hr",
            "foreign": "employee",
        }[actor]
        self.report.require(
            profile["user"]["role"] == expected_role and employee.get("is_active") is True,
            f"{actor}.expected_active_role",
        )
        self.report.require(
            identifier(employee["id"]) == identifier(account["employee_id"]),
            f"{actor}.credential_employee_matches_session",
        )
        session.employee = employee
        session.role = expected_role
        self.report.require(bool(list(session.cookies)), f"{actor}.cookie_session_present")

    def prepare(self) -> None:
        try:
            raw = self.args.credentials_file.read_bytes()
            if len(raw) > 1024 * 1024:
                raise ValueError()
            document = json.loads(raw)
            if not isinstance(document, dict) or document.get("synthetic") is not True:
                raise ValueError()
            accounts = {item["username"]: item for item in document["accounts"]}
        except (OSError, ValueError, KeyError, TypeError) as error:
            raise SmokeFailure(
                "synthetic_credentials_file_required",
                "Use the private credentials JSON created by seed_demo for this local demo.",
            ) from error
        names = {
            "employee": self.args.employee,
            "manager": self.args.manager,
            "hr": self.args.hr,
            "foreign": self.args.foreign_employee,
        }
        self.report.require(len(set(names.values())) == 4, "independent_demo_accounts")
        for actor, name in names.items():
            self.report.require(
                name.endswith(".demo") and name in accounts, f"{actor}.named_synthetic_account"
            )
            self.login(actor, name, accounts[name])
        employee = self.sessions["employee"].employee
        manager = self.sessions["manager"].employee
        hr = self.sessions["hr"].employee
        foreign = self.sessions["foreign"].employee
        self.report.require(
            employee["manager"] == manager["id"], "employee_has_selected_direct_manager"
        )
        self.report.require(
            employee["legal_entity"]["id"]
            == manager["legal_entity"]["id"]
            == hr["legal_entity"]["id"],
            "reviewers_share_employee_entity",
        )
        self.report.require(
            foreign["legal_entity"]["id"] != employee["legal_entity"]["id"],
            "foreign_actor_is_in_another_entity",
        )
        self.report.observations["target"] = self.base_url
        self.report.observations["transport"] = (
            "stdlib urllib, CookieJar, no redirects, no environment proxies"
        )

    def bench(self, actor: str, label: str) -> dict[str, Any]:
        body = self.api(label, actor, "GET", f"{API}workbench/?preview_limit=2").body
        self.report.require(
            body["employee"]["id"] == self.sessions[actor].employee["id"], f"{label}.own_profile"
        )
        for name in (
            "returned_requests",
            "draft_requests",
            "requests_to_review",
            "learning_outstanding",
            "open_knowledge_cases",
        ):
            part = body[name]
            self.report.require(
                type(part["count"]) is int
                and part["count"] >= 0
                and isinstance(part["results"], list)
                and len(part["results"]) <= min(2, part["count"]),
                f"{label}.{name}.full_count_and_bounded_preview",
            )
        return body

    def verify_workbench(self, actor: str, label: str) -> dict[str, Any]:
        body = self.bench(actor, label)
        employee_id = self.sessions[actor].employee["id"]
        visible = self.all_items(actor, "requests", ordering="created_at")
        own = [item for item in visible if item["employee"] == employee_id]
        counts = {
            "draft_requests": sum(item["status"] == "draft" for item in own),
            "returned_requests": sum(item["status"] == "returned" for item in own),
            "requests_to_review": sum("approve" in item["allowed_actions"] for item in visible),
        }
        for name, count in counts.items():
            self.report.require(
                body[name]["count"] == count, f"{label}.{name}.matches_scoped_registry"
            )
            for item in body[name]["results"]:
                fresh = self.api(
                    f"{label}.{name}.current_actions",
                    actor,
                    "GET",
                    f"{API}requests/{identifier(item['id'])}/",
                ).body
                self.report.require(
                    item["allowed_actions"] == fresh["allowed_actions"],
                    f"{label}.{name}.actions_match_detail",
                )
                if name == "requests_to_review":
                    self.report.require(
                        item["employee"] != employee_id and "approve" in item["allowed_actions"],
                        f"{label}.review_excludes_self",
                    )
        waiting = sum(item["status"] in {"pending_manager", "pending_hr"} for item in own)
        self.report.require(
            body["waiting_request_count"] == waiting, f"{label}.waiting_matches_registry"
        )
        learning = self.all_items(actor, "academy/enrollments", employee=employee_id)
        self.report.require(
            all(item["employee"] == employee_id for item in learning),
            f"{label}.learning_is_self_scoped",
        )
        expected = {
            "total": len(learning),
            **{
                state: sum(item["completion_state"] == state for item in learning)
                for state in ("completed", "in_progress", "not_started")
            },
        }
        self.report.require(
            body["learning_summary"]["scope"] == "self"
            and all(body["learning_summary"][key] == value for key, value in expected.items()),
            f"{label}.learning_summary_matches_registry",
        )
        available = sum(
            item["completed_at"] is None and item["availability"] == "published"
            for item in learning
        )
        unavailable = sum(
            item["completed_at"] is None and item["availability"] != "published"
            for item in learning
        )
        self.report.require(
            body["learning_outstanding"]["count"] == available
            and body["unavailable_learning_count"] == unavailable,
            f"{label}.learning_availability_counts",
        )
        for item in body["learning_outstanding"]["results"]:
            fresh = self.api(
                f"{label}.learning.current_actions",
                actor,
                "GET",
                f"{API}academy/enrollments/{identifier(item['id'])}/",
            ).body
            self.report.require(
                item["allowed_actions"] == fresh["allowed_actions"],
                f"{label}.learning.actions_match_detail",
            )
        self.report.require(
            type(body["unread_notification_count"]) is int
            and body["unread_notification_count"] >= 0,
            f"{label}.unread_count_is_nonnegative",
        )
        self.report.observations.setdefault("workbench", {})[label] = {
            **counts,
            "waiting_requests": waiting,
            "learning": expected,
            "learning_outstanding": available,
            "unavailable_learning": unavailable,
            "unread_notifications": body["unread_notification_count"],
        }
        return body

    def free_leave_day(self, baseline: dict[str, Any]) -> date:
        self.report.require(
            Decimal(baseline["leave"]["projected_balance"]) >= Decimal("1"),
            "synthetic_employee_has_one_unreserved_leave_day",
        )
        candidate = datetime.fromisoformat(
            baseline["computed_at"].replace("Z", "+00:00")
        ).date() + timedelta(days=30)
        records = self.all_items(
            "employee",
            "requests",
            kind="leave",
            employee=self.sessions["employee"].employee["id"],
            ordering="start_date",
        )
        intervals = sorted(
            (date.fromisoformat(item["start_date"]), date.fromisoformat(item["end_date"]))
            for item in records
            if item["start_date"] and item["end_date"]
        )
        for start, end in intervals:
            if start <= candidate <= end:
                if end == date.max:
                    raise SmokeFailure("available_future_leave_date_required")
                candidate = end + timedelta(days=1)
        self.report.require(
            all(not start <= candidate <= end for start, end in intervals),
            "future_leave_date_avoids_existing_api_records",
        )
        return candidate

    def replay(
        self,
        actor: str,
        path: str,
        payload: dict[str, Any],
        key: str,
        original: HTTPResult,
        check: str,
        *,
        method: str = "POST",
    ) -> None:
        response = self.api(
            check, actor, method, path, body=payload, key=key, expected=original.status
        )
        self.report.require(
            response.headers.get("idempotency-replayed") == "true"
            and response.body == original.body,
            f"{check}.original_result_preserved",
        )

    def request_journey(self, kind: str, details: dict[str, Any]) -> None:
        before = {
            actor: self.bench(actor, f"{kind}.{actor}.before")
            for actor in ("employee", "manager", "hr")
        }
        payload = {
            "kind": kind,
            "reason": f"Synthetic HTTP smoke {self.report.run_id}: original {kind}.",
            **details,
        }
        create_key = str(uuid.uuid4())
        created = self.command(
            f"{kind}.create", "employee", f"{API}requests/", payload, key=create_key, expected=201
        )
        request_id = identifier(created.body["id"])
        artifact = {
            "id": request_id,
            "kind": kind,
            "purpose": "approval_journey",
            "status": created.body["status"],
        }
        self.report.artifacts["requests"].append(artifact)
        path = f"{API}requests/{request_id}/"
        current = created.body
        self.report.require(
            current["status"] == "draft" and "update_draft" in current["allowed_actions"],
            f"{kind}.draft_owner_actions",
        )
        self.replay(
            "employee", f"{API}requests/", payload, create_key, created, f"{kind}.create_replay"
        )
        self.command(
            f"{kind}.key_payload_conflict",
            "employee",
            f"{API}requests/",
            {**payload, "reason": "Different synthetic command."},
            key=create_key,
            expected=409,
        )
        self.api(
            f"{kind}.unsafe_write_without_csrf_denied",
            "employee",
            "PATCH",
            path,
            body={"expected_version": current["version"], "reason": "Synthetic blocked edit."},
            key=str(uuid.uuid4()),
            csrf=False,
            expected=403,
            expect_json=False,
        )
        self.api(
            f"{kind}.status_mass_assignment_denied",
            "employee",
            "PATCH",
            path,
            body={"expected_version": current["version"], "status": "approved"},
            key=str(uuid.uuid4()),
            expected=400,
        )
        old_version = current["version"]
        edited = self.api(
            f"{kind}.edit_draft",
            "employee",
            "PATCH",
            path,
            body={
                "expected_version": old_version,
                "reason": f"Synthetic HTTP smoke {self.report.run_id}: draft details.",
            },
            key=str(uuid.uuid4()),
        )
        current = edited.body
        self.api(
            f"{kind}.stale_draft_conflict",
            "employee",
            "PATCH",
            path,
            body={"expected_version": old_version, "reason": "Synthetic stale update."},
            key=str(uuid.uuid4()),
            expected=409,
        )
        draft_bench = self.bench("employee", f"{kind}.draft_workbench")
        self.report.require(
            draft_bench["draft_requests"]["count"]
            == before["employee"]["draft_requests"]["count"] + 1,
            f"{kind}.draft_in_workbench_count",
        )
        submit_payload = {"expected_version": current["version"]}
        submit_key = str(uuid.uuid4())
        submitted = self.command(
            f"{kind}.submit", "employee", f"{path}submit/", submit_payload, key=submit_key
        )
        self.replay(
            "employee",
            f"{path}submit/",
            submit_payload,
            submit_key,
            submitted,
            f"{kind}.submit_replay",
        )
        current = submitted.body
        self.report.require(
            current["status"] == "pending_manager" and current["submission_number"] == 1,
            f"{kind}.manager_stage_and_first_revision",
        )
        first_revision = current["revisions"][0]
        self.command(
            f"{kind}.employee_self_approval_denied",
            "employee",
            f"{path}approve/",
            {"expected_version": current["version"]},
            expected=403,
        )
        self.command(
            f"{kind}.hr_cannot_skip_manager",
            "hr",
            f"{path}approve/",
            {"expected_version": current["version"]},
            expected=403,
        )
        self.api(f"{kind}.foreign_detail_hidden", "foreign", "GET", path, expected=404)
        self.command(
            f"{kind}.foreign_command_hidden",
            "foreign",
            f"{path}approve/",
            {"expected_version": current["version"]},
            expected=404,
        )
        foreign_list = self.all_items(
            "foreign", "requests", employee=self.sessions["employee"].employee["id"]
        )
        self.report.require(not foreign_list, f"{kind}.foreign_list_scope")
        manager_bench = self.bench("manager", f"{kind}.manager_waiting_workbench")
        self.report.require(
            manager_bench["requests_to_review"]["count"]
            == before["manager"]["requests_to_review"]["count"] + 1,
            f"{kind}.manager_review_count_increased",
        )
        current = self.command(
            f"{kind}.return_for_changes",
            "manager",
            f"{path}return-for-changes/",
            {
                "expected_version": current["version"],
                "comment": "Synthetic review: clarify the request details.",
            },
        ).body
        returned = self.api(f"{kind}.owner_reads_return", "employee", "GET", path).body
        self.report.require(
            returned["status"] == "returned" and "update_draft" in returned["allowed_actions"],
            f"{kind}.returned_owner_can_edit",
        )
        returned_bench = self.bench("employee", f"{kind}.returned_workbench")
        self.report.require(
            returned_bench["returned_requests"]["count"]
            == before["employee"]["returned_requests"]["count"] + 1,
            f"{kind}.returned_count_increased",
        )
        changes = {
            "expected_version": current["version"],
            "reason": f"Synthetic HTTP smoke {self.report.run_id}: clarified {kind}.",
        }
        if kind == "advance":
            changes["amount"] = "15500.00"
        current = self.api(
            f"{kind}.edit_returned", "employee", "PATCH", path, body=changes, key=str(uuid.uuid4())
        ).body
        current = self.command(
            f"{kind}.resubmit",
            "employee",
            f"{path}submit/",
            {"expected_version": current["version"]},
        ).body
        self.report.require(
            current["submission_number"] == 2
            and len(current["revisions"]) == 2
            and current["revisions"][0] == first_revision
            and current["revisions"][1]["payload"]["reason"] == changes["reason"],
            f"{kind}.resubmission_preserves_immutable_first_snapshot",
        )
        manager_detail = self.api(f"{kind}.manager_current_actions", "manager", "GET", path).body
        self.report.require(
            "approve" in manager_detail["allowed_actions"], f"{kind}.manager_can_approve"
        )
        current = self.command(
            f"{kind}.manager_approves",
            "manager",
            f"{path}approve/",
            {"expected_version": current["version"], "comment": "Synthetic manager approval."},
        ).body
        self.report.require(current["status"] == "pending_hr", f"{kind}.hr_stage")
        self.command(
            f"{kind}.manager_cannot_finalize",
            "manager",
            f"{path}approve/",
            {"expected_version": current["version"]},
            expected=403,
        )
        hr_bench = self.bench("hr", f"{kind}.hr_waiting_workbench")
        self.report.require(
            hr_bench["requests_to_review"]["count"]
            == before["hr"]["requests_to_review"]["count"] + 1,
            f"{kind}.hr_review_count_increased",
        )
        approve_payload = {
            "expected_version": current["version"],
            "comment": "Synthetic HR approval. This does not confirm payment or signature.",
        }
        approve_key = str(uuid.uuid4())
        approved = self.command(
            f"{kind}.hr_approves", "hr", f"{path}approve/", approve_payload, key=approve_key
        )
        self.replay(
            "hr",
            f"{path}approve/",
            approve_payload,
            approve_key,
            approved,
            f"{kind}.approval_replay",
        )
        final = self.api(f"{kind}.employee_reads_final_state", "employee", "GET", path).body
        self.report.require(
            final["status"] == "approved" and final["allowed_actions"] == [],
            f"{kind}.approved_terminal_owner_state",
        )
        actions = [item["action"] for item in final["history"]]
        self.report.require(
            actions
            == [
                "created",
                "edited",
                "submitted",
                "returned",
                "edited",
                "submitted",
                "approved",
                "approved",
            ],
            f"{kind}.complete_chronological_history",
        )
        self.report.require(
            [item["version"] for item in final["history"]] == list(range(1, final["version"] + 1)),
            f"{kind}.history_versions_monotonic",
        )
        artifact.update(
            status="approved",
            version=final["version"],
            submitted_revisions=2,
            final_revision=identifier(final["revisions"][-1]["id"]),
        )
        if kind == "leave":
            artifact.update(
                start_date=final["start_date"],
                end_date=final["end_date"],
                leave_days=final["leave_days"],
            )
        self.approved.append(
            {"id": request_id, "revision": artifact["final_revision"], "history": final["history"]}
        )

    def privileged_and_entity_denials(self, payment_date: str) -> None:
        for owner in ("hr", "foreign"):
            current = self.command(
                f"{owner}.create_denial_probe",
                owner,
                f"{API}requests/",
                {
                    "kind": "advance",
                    "amount": "1000.00",
                    "currency": "KZT",
                    "requested_payment_date": payment_date,
                    "reason": f"Synthetic HTTP smoke {self.report.run_id}: access probe.",
                },
                expected=201,
            ).body
            request_id = identifier(current["id"])
            artifact = {
                "id": request_id,
                "kind": "advance",
                "purpose": f"{owner}_denial_probe",
                "status": current["status"],
            }
            self.report.artifacts["requests"].append(artifact)
            path = f"{API}requests/{request_id}/"
            current = self.command(
                f"{owner}.submit_denial_probe",
                owner,
                f"{path}submit/",
                {"expected_version": current["version"]},
            ).body
            self.command(
                f"{owner}.self_approval_denied",
                owner,
                f"{path}approve/",
                {"expected_version": current["version"]},
                expected=403,
            )
            if owner == "hr":
                self.report.require(
                    "approve" not in current["allowed_actions"], "hr.no_self_approval_action"
                )
                own_bench = self.bench("hr", "hr.self_request_workbench")
                self.report.require(
                    all(
                        item["id"] != request_id
                        for item in own_bench["requests_to_review"]["results"]
                    ),
                    "hr.self_request_not_in_review_preview",
                )
                self.api(
                    "employee.cannot_read_hr_personal_request",
                    "employee",
                    "GET",
                    path,
                    expected=404,
                )
            else:
                for actor in ("manager", "hr"):
                    self.api(f"{actor}.foreign_request_hidden", actor, "GET", path, expected=404)
                    self.command(
                        f"{actor}.foreign_approval_hidden",
                        actor,
                        f"{path}approve/",
                        {"expected_version": current["version"]},
                        expected=404,
                    )
            cancelled = self.command(
                f"{owner}.cancel_own_probe",
                owner,
                f"{path}cancel/",
                {"expected_version": current["version"]},
            ).body
            self.report.require(cancelled["status"] == "cancelled", f"{owner}.probe_cancelled")
            artifact.update(status="cancelled", version=cancelled["version"])

    def no_answer_keys(self, body: Any, check: str) -> None:
        forbidden = {"correct_option_id", "explanation", "question_snapshot"}

        def clean(value: Any) -> bool:
            if isinstance(value, dict):
                return not forbidden.intersection(value) and all(
                    clean(item) for item in value.values()
                )
            if isinstance(value, list):
                return all(clean(item) for item in value)
            return not isinstance(value, str) or self.answer_sentinel not in value

        self.report.require(clean(body), check)

    def academy_journey(self, due_at: str) -> None:
        before = self.bench("employee", "academy.employee.before")
        draft = {
            "title": f"Синтетический курс проверки HTTP {self.report.run_id[:8]}",
            "summary": "Демонстрационное обучение для проверки портала. Это не регламент Jana Post.",
            "category": "hr",
            "content_language": "ru",
            "passing_percent": 100,
            "max_attempts": 3,
            "estimated_minutes": 5,
            "lessons": [
                {
                    "id": "human-review",
                    "title": "Кто принимает решение",
                    "body_markdown": "Синтетический пример. Решение по заявке принимает уполномоченный человек. AI не согласует заявку.",
                    "required": True,
                },
                {
                    "id": "receipt",
                    "title": "Что означает квитанция",
                    "body_markdown": "Синтетический пример. Квитанция подтверждает получение документа. Она не подтверждает выплату или подпись.",
                    "required": True,
                },
            ],
            "questions": [
                {
                    "id": "reviewer",
                    "prompt": "Кто принимает кадровое решение в этом примере?",
                    "options": [
                        {"id": "human", "text": "Уполномоченный человек"},
                        {"id": "ai", "text": "AI-ассистент"},
                    ],
                    "correct_option_id": "human",
                    "explanation": self.answer_sentinel,
                },
                {
                    "id": "meaning",
                    "prompt": "Что подтверждает квитанция в этом примере?",
                    "options": [
                        {"id": "received", "text": "Получение документа"},
                        {"id": "paid", "text": "Выплату денег"},
                    ],
                    "correct_option_id": "received",
                    "explanation": self.answer_sentinel,
                },
            ],
        }
        payload = {"slug": f"http-smoke-{self.report.run_id}", "draft": draft}
        self.command(
            "academy.employee_cannot_author",
            "employee",
            f"{API}academy/manage/courses/",
            payload,
            expected=403,
        )
        self.api(
            "academy.manager_cannot_open_authoring",
            "manager",
            "GET",
            f"{API}academy/manage/courses/",
            expected=403,
        )
        create_key = str(uuid.uuid4())
        created = self.command(
            "academy.hr_creates_course",
            "hr",
            f"{API}academy/manage/courses/",
            payload,
            key=create_key,
            expected=201,
        )
        course_id = identifier(created.body["id"])
        self.report.artifacts["course"] = {
            "id": course_id,
            "slug": payload["slug"],
            "availability": created.body["availability"],
        }
        course_path = f"{API}academy/manage/courses/{course_id}/"
        self.replay(
            "hr",
            f"{API}academy/manage/courses/",
            payload,
            create_key,
            created,
            "academy.course_create_replay",
        )
        self.api(
            "academy.draft_not_in_learner_catalog",
            "employee",
            "GET",
            f"{API}academy/courses/{course_id}/",
            expected=404,
        )
        course = self.command(
            "academy.hr_publishes",
            "hr",
            f"{course_path}publish/",
            {"expected_version": created.body["version"]},
        ).body
        revision_id = identifier(course["published_version"])
        self.command(
            "academy.stale_publish_conflict",
            "hr",
            f"{course_path}publish/",
            {"expected_version": created.body["version"]},
            expected=409,
        )
        catalog = self.api(
            "academy.published_course_in_catalog",
            "employee",
            "GET",
            f"{API}academy/courses/{course_id}/",
        ).body
        self.no_answer_keys(catalog, "academy.catalog_has_no_answer_key")
        assignment = {
            "employee": self.sessions["employee"].employee["id"],
            "course_version": revision_id,
            "required": True,
            "due_at": due_at,
        }
        for actor in ("employee", "manager"):
            self.command(
                f"academy.{actor}_cannot_assign",
                actor,
                f"{API}academy/enrollments/",
                assignment,
                expected=403,
            )
        assignment_key = str(uuid.uuid4())
        assigned = self.command(
            "academy.hr_assigns",
            "hr",
            f"{API}academy/enrollments/",
            assignment,
            key=assignment_key,
            expected=201,
        )
        enrollment_id = identifier(assigned.body["id"])
        self.report.artifacts["enrollment"] = {
            "id": enrollment_id,
            "course_version": revision_id,
            "completion_state": assigned.body["completion_state"],
        }
        enrollment_path = f"{API}academy/enrollments/{enrollment_id}/"
        self.replay(
            "hr",
            f"{API}academy/enrollments/",
            assignment,
            assignment_key,
            assigned,
            "academy.assignment_replay",
        )
        self.command(
            "academy.duplicate_assignment_conflict",
            "hr",
            f"{API}academy/enrollments/",
            assignment,
            expected=409,
        )
        current = self.api(
            "academy.employee_reads_assignment", "employee", "GET", enrollment_path
        ).body
        self.report.require(
            current["completion_state"] == "not_started"
            and "start" in current["allowed_actions"]
            and "submit_attempt" not in current["allowed_actions"],
            "academy.initial_owner_actions",
        )
        assigned_bench = self.bench("employee", "academy.assigned_workbench")
        self.report.require(
            assigned_bench["learning_outstanding"]["count"]
            == before["learning_outstanding"]["count"] + 1,
            "academy.assignment_in_workbench_count",
        )
        self.api(
            "academy.foreign_enrollment_hidden", "foreign", "GET", enrollment_path, expected=404
        )
        self.command(
            "academy.foreign_progress_hidden",
            "foreign",
            f"{enrollment_path}start/",
            {"expected_version": current["version"]},
            expected=404,
        )
        manager_view = self.api(
            "academy.manager_reads_team_progress", "manager", "GET", enrollment_path
        ).body
        self.report.require(
            manager_view["allowed_actions"] == [], "academy.manager_has_no_learner_actions"
        )
        self.command(
            "academy.manager_cannot_complete_for_employee",
            "manager",
            f"{enrollment_path}complete-lesson/",
            {"expected_version": current["version"], "lesson_id": "human-review"},
            expected=403,
        )
        learning = self.api(
            "academy.employee_reads_materials", "employee", "GET", f"{enrollment_path}learning/"
        ).body
        self.report.require(
            len(learning["lessons"]) == 2 and len(learning["questions"]) == 2,
            "academy.complete_published_materials",
        )
        self.no_answer_keys(learning, "academy.learning_has_no_answer_key")
        correct = [
            {"question_id": question["id"], "selected_option_id": question["correct_option_id"]}
            for question in draft["questions"]
        ]
        wrong = [
            {"question_id": "reviewer", "selected_option_id": "ai"},
            {"question_id": "meaning", "selected_option_id": "paid"},
        ]
        original_version = current["version"]
        current = self.command(
            "academy.employee_starts",
            "employee",
            f"{enrollment_path}start/",
            {"expected_version": original_version},
        ).body
        self.command(
            "academy.stale_progress_conflict",
            "employee",
            f"{enrollment_path}complete-lesson/",
            {"expected_version": original_version, "lesson_id": "human-review"},
            expected=409,
        )
        self.command(
            "academy.quiz_requires_materials",
            "employee",
            f"{enrollment_path}submit-attempt/",
            {"expected_version": current["version"], "answers": correct},
            expected=409,
        )
        self.command(
            "academy.client_score_rejected",
            "employee",
            f"{enrollment_path}submit-attempt/",
            {
                "expected_version": current["version"],
                "answers": correct,
                "score": "100.00",
                "passed": True,
            },
            expected=400,
        )
        for index, lesson in enumerate(learning["lessons"], start=1):
            current = self.command(
                f"academy.complete_material.{index}",
                "employee",
                f"{enrollment_path}complete-lesson/",
                {"expected_version": current["version"], "lesson_id": lesson["id"]},
            ).body
            self.report.require(
                current["material_progress"]["percent"] == index * 50,
                f"academy.material_progress.{index}",
            )
        self.report.require(
            "submit_attempt" in current["allowed_actions"], "academy.quiz_action_after_materials"
        )
        attempt_payload = {"expected_version": current["version"], "answers": wrong}
        attempt_key = str(uuid.uuid4())
        failed = self.command(
            "academy.failed_attempt",
            "employee",
            f"{enrollment_path}submit-attempt/",
            attempt_payload,
            key=attempt_key,
            expected=201,
        )
        self.replay(
            "employee",
            f"{enrollment_path}submit-attempt/",
            attempt_payload,
            attempt_key,
            failed,
            "academy.attempt_replay",
        )
        self.report.require(
            failed.body["attempt"]["passed"] is False
            and Decimal(failed.body["attempt"]["score"]) == 0
            and failed.body["enrollment"]["completed_at"] is None
            and failed.body["enrollment"]["material_progress"]["percent"] == 100,
            "academy.server_failure_preserves_material_progress",
        )
        self.no_answer_keys(failed.body, "academy.failed_result_has_no_answer_key")
        current = failed.body["enrollment"]
        passed = self.command(
            "academy.passing_attempt",
            "employee",
            f"{enrollment_path}submit-attempt/",
            {"expected_version": current["version"], "answers": correct},
            expected=201,
        ).body
        self.report.require(
            passed["attempt"]["passed"] is True
            and Decimal(passed["attempt"]["score"]) == 100
            and passed["attempt"]["correct_count"] == 2
            and passed["attempt"]["material_completed"] is True,
            "academy.server_calculates_passing_result",
        )
        self.no_answer_keys(passed, "academy.passing_result_has_no_answer_key")
        final = self.api("academy.persisted_completion", "employee", "GET", enrollment_path).body
        self.report.require(
            final["completion_state"] == "completed"
            and final["completed_at"] is not None
            and final["allowed_actions"] == []
            and final["attempt_count"] == 2
            and final["has_failed_attempt"] is True,
            "academy.completion_and_attempt_history_preserved",
        )
        attempts = self.all_items("employee", f"academy/enrollments/{enrollment_id}/attempts")
        self.no_answer_keys(attempts, "academy.attempt_history_has_no_answer_key")
        self.report.require(
            len(attempts) == 2 and [item["passed"] for item in attempts] == [False, True],
            "academy.exactly_two_server_attempts",
        )
        changed_draft = {**draft, "title": f"{draft['title']} версия 2"}
        course = self.command(
            "academy.hr_edits_new_draft",
            "hr",
            f"{course_path}save-draft/",
            {"expected_version": course["version"], "draft": changed_draft},
        ).body
        course = self.command(
            "academy.hr_publishes_second_version",
            "hr",
            f"{course_path}publish/",
            {"expected_version": course["version"]},
        ).body
        historical = self.api(
            "academy.original_learning_after_republish",
            "employee",
            "GET",
            f"{enrollment_path}learning/",
        ).body
        self.report.require(
            course["published_version"] != revision_id
            and historical["id"] == revision_id
            and historical["title"] == draft["title"],
            "academy.enrollment_pins_published_version",
        )
        self.no_answer_keys(historical, "academy.historical_material_has_no_answer_key")
        course = self.command(
            "academy.hr_archives_own_smoke_course",
            "hr",
            f"{course_path}archive/",
            {"expected_version": course["version"]},
        ).body
        self.api(
            "academy.archived_course_hidden_from_catalog",
            "employee",
            "GET",
            f"{API}academy/courses/{course_id}/",
            expected=404,
        )
        archived_result = self.api(
            "academy.completed_result_after_archive", "employee", "GET", enrollment_path
        ).body
        self.report.require(
            archived_result["completion_state"] == "completed"
            and archived_result["availability"] == "archived"
            and archived_result["completed_at"] == final["completed_at"]
            and archived_result["attempt_count"] == 2,
            "academy.archive_preserves_completed_history",
        )
        after = self.bench("employee", "academy.completed_workbench")
        self.report.require(
            after["learning_summary"]["total"] == before["learning_summary"]["total"] + 1
            and after["learning_summary"]["completed"]
            == before["learning_summary"]["completed"] + 1
            and after["learning_outstanding"]["count"] == before["learning_outstanding"]["count"],
            "academy.completion_updates_own_workbench",
        )
        self.report.artifacts["course"].update(
            availability=course["availability"], published_revisions=2
        )
        self.report.artifacts["enrollment"].update(
            completion_state="completed", attempts=2, result_scores=["0.00", "100.00"]
        )

    def integration_journey(self) -> None:
        for actor in ("employee", "manager"):
            self.api(
                f"integration.{actor}_operator_access_denied",
                actor,
                "GET",
                f"{API}integrations/exports/",
                expected=403,
            )
        exports = self.all_items("hr", "integrations/exports", ordering="created_at")
        expected = {item["id"]: item for item in self.approved}
        selected = [item for item in exports if item["request_id"] in expected]
        self.report.require(
            len(selected) == 2 and {item["request_id"] for item in selected} == set(expected),
            "integration.one_outbox_per_new_final_approval",
        )
        deadline = time.monotonic() + self.args.wait_for_exports
        observed: dict[str, list[str]] = {}
        while True:
            complete = True
            latest = []
            for item in selected:
                export_id = identifier(item["id"])
                detail = self.api(
                    "integration.export_detail",
                    "hr",
                    "GET",
                    f"{API}integrations/exports/{export_id}/",
                ).body
                state = detail["delivery_status"]
                self.report.require(
                    state in {"pending", "processing", "processed", "failed"},
                    "integration.explicit_delivery_state",
                )
                states = observed.setdefault(export_id, [])
                if not states or states[-1] != state:
                    states.append(state)
                self.report.require(
                    detail["topic"] == "documentolog.export_request" and state != "failed",
                    "integration.new_export_has_no_delivery_failure",
                )
                evidence = {
                    "id": export_id,
                    "request_id": identifier(detail["request_id"]),
                    "delivery_status": state,
                    "observed_states": list(states),
                    "attempt_count": detail["attempt_count"],
                }
                if state == "processed":
                    receipt = detail["export_receipt"]
                    self.report.require(
                        isinstance(receipt, dict)
                        and receipt["provider"] == "mock_documentolog"
                        and receipt["acceptance_meaning"] == "document_received_only"
                        and receipt["request_revision"]
                        == expected[detail["request_id"]]["revision"]
                        and detail["processed_at"] is not None,
                        "integration.receipt_confirms_only_mock_document_acceptance",
                    )
                    self.report.require(
                        bool(detail["delivery_attempts"])
                        and detail["delivery_attempts"][-1]["result"]["outcome"] == "accepted",
                        "integration.accepted_attempt_persisted",
                    )
                    evidence["receipt"] = {
                        "id": identifier(receipt["id"]),
                        "provider": "mock_documentolog",
                        "request_revision": identifier(receipt["request_revision"]),
                        "acceptance_meaning": "document_received_only",
                    }
                else:
                    complete = False
                    self.report.require(
                        detail["export_receipt"] is None,
                        "integration.pending_has_no_acceptance_claim",
                    )
                latest.append(evidence)
            self.report.artifacts["exports"] = latest
            if complete or self.args.wait_for_exports == 0:
                self.report.observations["mock_export_delivery_verified"] = complete
                break
            if time.monotonic() >= deadline:
                raise SmokeFailure(
                    "integration.worker_poll_timeout",
                    "Run process_outbox --watch for this demo database, then start a new smoke run.",
                )
            time.sleep(min(self.args.poll_interval, max(0, deadline - time.monotonic())))
        for item in self.approved:
            final = self.api(
                "integration.business_decision_after_delivery",
                "employee",
                "GET",
                f"{API}requests/{item['id']}/",
            ).body
            self.report.require(
                final["status"] == "approved" and final["history"] == item["history"],
                "integration.delivery_does_not_rewrite_human_decision",
            )

    def run(self) -> None:
        self.prepare()
        baseline = self.verify_workbench("employee", "baseline.employee")
        self.verify_workbench("manager", "baseline.manager")
        self.verify_workbench("hr", "baseline.hr")
        chosen_day = self.free_leave_day(baseline)
        self.api(
            "official_employee_facts_are_read_only",
            "employee",
            "PATCH",
            f"{API}employees/{identifier(self.sessions['employee'].employee['id'])}/",
            body={"leave_balance": "9999.00"},
            expected=405,
        )
        self.request_journey(
            "leave", {"start_date": chosen_day.isoformat(), "end_date": chosen_day.isoformat()}
        )
        self.request_journey(
            "advance",
            {
                "amount": "12500.00",
                "currency": "KZT",
                "requested_payment_date": chosen_day.isoformat(),
            },
        )
        self.privileged_and_entity_denials(chosen_day.isoformat())
        self.academy_journey(f"{chosen_day.isoformat()}T12:00:00+05:00")
        self.integration_journey()
        final = self.verify_workbench("employee", "final.employee")
        self.verify_workbench("manager", "final.manager")
        self.verify_workbench("hr", "final.hr")
        self.report.require(
            final["leave"]["official_balance"] == baseline["leave"]["official_balance"]
            and final["leave"]["source_incorporated_days"]
            == baseline["leave"]["source_incorporated_days"]
            and Decimal(final["leave"]["projected_balance"])
            == Decimal(baseline["leave"]["projected_balance"]) - 1,
            "official_balance_unchanged_and_one_new_portal_day_reserved",
        )
        self.report.observations["leave_projection"] = {
            "official_balance": final["leave"]["official_balance"],
            "projected_before": baseline["leave"]["projected_balance"],
            "projected_after": final["leave"]["projected_balance"],
            "source_incorporated_days": final["leave"]["source_incorporated_days"],
        }

    def logout(self) -> None:
        for actor, session in self.sessions.items():
            if session.authenticated:
                try:
                    self.api(f"{actor}.logout", actor, "POST", f"{API}auth/logout/", expected=204)
                    session.authenticated = False
                except SmokeFailure as error:
                    if self.report.failure is None:
                        self.report.failure = {"check": error.check, "recovery": error.recovery}
                except Exception as error:
                    if self.report.failure is None:
                        self.report.failure = {
                            "check": "session_cleanup_error",
                            "error_type": type(error).__name__,
                            "recovery": "Inspect the local API logs. Cleanup continued for other sessions.",
                        }
                finally:
                    session.cookies.clear()
                    session.csrf_token = ""


def validate_report_path(path: Path, credentials_file: Path) -> None:
    if (
        path.is_symlink()
        or path.resolve() == credentials_file.resolve()
        or (
            path.exists()
            and credentials_file.exists()
            and os.path.samefile(path, credentials_file)
        )
    ):
        raise SmokeFailure("report_must_not_replace_credentials")


def write_report(path: Path, report: dict[str, Any], credentials_file: Path) -> None:
    validate_report_path(path, credentials_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=path.parent, delete=False
        ) as stream:
            temporary = Path(stream.name)
            json.dump(report, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify synthetic JanaMen workflows through real loopback HTTP sessions."
    )
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--credentials-file", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--wait-for-exports",
        type=float,
        default=0,
        help="Require mock export acknowledgments within this many seconds. A separate worker must run.",
    )
    parser.add_argument("--poll-interval", type=float, default=1)
    parser.add_argument("--request-timeout", type=float, default=20)
    parser.add_argument("--employee", default="employee.demo")
    parser.add_argument("--manager", default="manager.demo")
    parser.add_argument("--hr", default="hr.demo")
    parser.add_argument("--foreign-employee", default="foreign.demo")
    args = parser.parse_args()
    report = Report()
    runner = None
    try:
        validate_report_path(args.output, args.credentials_file)
        if (
            not 0 <= args.wait_for_exports <= 3600
            or not 0.1 <= args.poll_interval <= 30
            or not 0 < args.request_timeout <= 120
        ):
            raise SmokeFailure("bounded_time_arguments_required")
        runner = WorkflowSmoke(args, report)
        runner.run()
    except SmokeFailure as error:
        report.failure = {"check": error.check, "recovery": error.recovery}
    except KeyboardInterrupt:
        report.failure = {
            "check": "run_interrupted",
            "recovery": "Use the recorded resource identifiers to inspect this partial run.",
        }
    except Exception as error:
        report.failure = {
            "check": "runner_or_api_contract_error",
            "error_type": type(error).__name__,
            "recovery": "Inspect the runner and current generated API contract. Raw response and exception text are intentionally omitted.",
        }
    finally:
        if runner is not None:
            try:
                runner.logout()
            except Exception as error:
                if report.failure is None:
                    report.failure = {
                        "check": "session_cleanup_error",
                        "error_type": type(error).__name__,
                        "recovery": "Inspect the local API logs and expire this run's sessions.",
                    }
    document = report.document(runner.sessions if runner else {})
    if report.failure and report.failure["check"] == "report_must_not_replace_credentials":
        print("Smoke check refused: report output must not replace credentials.", file=sys.stderr)
        return 2
    try:
        write_report(args.output, document, args.credentials_file)
    except SmokeFailure:
        print("Smoke check refused: report output must not replace credentials.", file=sys.stderr)
        return 2
    except OSError:
        print(
            "Smoke report could not be written. No credentials or response bodies were printed.",
            file=sys.stderr,
        )
        return 2
    print(
        json.dumps(
            {
                "check": document["check"],
                "run_id": report.run_id,
                "outcome": document["outcome"],
                "passed": document["passed"],
                "total": document["total"],
                "failure": report.failure,
            },
            ensure_ascii=False,
        )
    )
    return 1 if report.failure else 0


if __name__ == "__main__":
    raise SystemExit(main())
