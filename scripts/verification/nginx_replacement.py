#!/usr/bin/env python3
import argparse
import json
import subprocess
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]


def command(arguments, *, check=True):
    result = subprocess.run(arguments, cwd=ROOT, capture_output=True, text=True, check=False)
    if check and result.returncode:
        raise RuntimeError(f"{arguments[0]} {arguments[1]} failed ({result.returncode}): {result.stderr.strip()}")
    return result.stdout.strip()


def ready(url):
    try:
        with urlopen(url, timeout=2) as response:
            return response.status == 200 and json.load(response).get("status") == "ready"
    except (HTTPError, URLError, TimeoutError, ConnectionError):
        return False


def wait_ready(url, seconds=30):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if ready(url):
            return
        time.sleep(1)
    raise RuntimeError(f"Readiness did not recover at {url}")


def main():
    parser = argparse.ArgumentParser(description="Replace the API in an owned synthetic Compose stack and verify nginx DNS recovery without restarting nginx.")
    parser.add_argument("--project", required=True, choices=["janamen-demo", "janamen-ci", "janamen-browser", "janamen-dns-test"])
    parser.add_argument("--web-url", default="http://127.0.0.1:8080")
    parser.add_argument("--api-url", default="http://127.0.0.1:8000")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if any(urlparse(url).hostname not in {"localhost", "127.0.0.1", "::1"} for url in [args.web_url, args.api_url]):
        parser.error("Use loopback URLs for the owned synthetic stack")
    if args.output.exists():
        parser.error("Choose a new evidence output path")
    compose = ["docker", "compose", "-p", args.project]
    api_id = command([*compose, "ps", "-q", "api"])
    frontend_id = command([*compose, "ps", "-q", "frontend"])
    if not api_id or not frontend_id:
        raise RuntimeError("API and frontend must already be running")
    networks = json.loads(command(["docker", "inspect", "-f", "{{json .NetworkSettings.Networks}}", api_id]))
    if len(networks) != 1:
        raise RuntimeError("Expected the dedicated single Compose network")
    network, state = next(iter(networks.items()))
    old_ip = state["IPAddress"]
    front_image = command(["docker", "inspect", "-f", "{{.Image}}", frontend_id])
    frontend_started = command(["docker", "inspect", "-f", "{{.State.StartedAt}}", frontend_id])
    api_ready = args.api_url.rstrip("/") + "/api/v1/ready/"
    web_ready = args.web_url.rstrip("/") + "/api/v1/ready/"
    wait_ready(api_ready)
    wait_ready(web_ready)
    report = {"project": args.project, "old_api_ip": old_ip, "frontend_id": frontend_id, "frontend_started_at": frontend_started, "passed": False, "stage": "replace_api"}
    probe_id = None
    replaced = False
    try:
        command(["docker", "stop", api_id])
        command(["docker", "rm", api_id])
        replaced = True
        report["stage"] = "hold_old_address"
        probe_id = command(["docker", "run", "--detach", "--rm", "--name", f"{args.project}-dns-probe-{uuid.uuid4().hex[:8]}", "--network", network, "--ip", old_ip, front_image, "/bin/sh", "-c", "sleep 120"])
        report["stage"] = "verify_replacement"
        command([*compose, "up", "-d", "--no-deps", "api"])
        replacement_id = command([*compose, "ps", "-q", "api"])
        replacement_networks = json.loads(command(["docker", "inspect", "-f", "{{json .NetworkSettings.Networks}}", replacement_id]))
        report["new_api_ip"] = replacement_networks[network]["IPAddress"]
        if report["new_api_ip"] == old_ip:
            raise RuntimeError("The replacement did not get a different address")
        wait_ready(api_ready)
        wait_ready(web_ready)
        current_frontend = command([*compose, "ps", "-q", "frontend"])
        if current_frontend != frontend_id:
            raise RuntimeError("The frontend was replaced during the check")
        report["frontend_started_at_after"] = command(["docker", "inspect", "-f", "{{.State.StartedAt}}", frontend_id])
        if report["frontend_started_at_after"] != frontend_started:
            raise RuntimeError("The frontend restarted during the check")
        report["passed"] = True
        report["stage"] = "complete"
    except Exception as error:
        report["error"] = str(error)
        raise
    finally:
        if replaced:
            command([*compose, "up", "-d", "--no-deps", "api"], check=False)
        if probe_id:
            command(["docker", "stop", "--timeout", "2", probe_id], check=False)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps(report))


if __name__ == "__main__":
    main()
