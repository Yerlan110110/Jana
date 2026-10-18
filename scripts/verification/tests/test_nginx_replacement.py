import importlib.util
import io
import json
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "nginx_replacement.py"
SPEC = importlib.util.spec_from_file_location("nginx_replacement", SCRIPT)
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


class DockerFixture:
    def __init__(self, *, image_available=True, reservation_available=True):
        self.image_available = image_available
        self.reservation_available = reservation_available
        self.calls = []
        self.api_id = "old-api"
        self.api_running = True
        self.probe_running = False

    def run(self, arguments, **kwargs):
        self.calls.append(arguments)
        output, error, code = "", "", 0
        if arguments[:4] == ["docker", "compose", "-p", "janamen-ci"]:
            action = arguments[4:]
            if action[:2] == ["ps", "-q"]:
                output = self.api_id if action[2] == "api" else "frontend"
            elif action[0] == "port":
                output = "127.0.0.1:8010" if action[1] == "api" else "127.0.0.1:8090"
            elif action == ["up", "-d", "--no-deps", "api"]:
                self.api_id, self.api_running = "new-api", True
            else:
                raise AssertionError(arguments)
        elif arguments[:2] == ["docker", "inspect"]:
            template = arguments[3]
            if template == "{{json .NetworkSettings.Networks}}":
                ip = "172.29.1.3" if arguments[4] == "old-api" else "172.29.1.5"
                output = json.dumps({"janamen-ci_default": {"IPAddress": ip}})
            else:
                output = {
                    "{{.Image}}": "sha256:container-config",
                    "{{.Config.Image}}": "janamen-ci-frontend:local",
                    "{{.State.StartedAt}}": "2026-10-18T02:27:25Z",
                }[template]
        elif arguments[:3] == ["docker", "image", "inspect"]:
            if self.image_available and arguments[-1] == "janamen-ci-frontend:local":
                output = "sha256:local-image-index"
            else:
                error, code = "No such image", 1
        elif arguments[:2] == ["docker", "run"]:
            image = arguments[arguments.index("/bin/sh") - 1]
            if image != "sha256:local-image-index":
                error, code = f"No such image: {image}", 125
            elif not self.reservation_available:
                error, code = "Address already in use", 125
            else:
                output, self.probe_running = "owned-probe", True
        elif arguments[:2] == ["docker", "stop"]:
            if arguments[-1] == "owned-probe":
                self.probe_running = False
            else:
                self.api_running = False
        elif arguments == ["docker", "rm", "old-api"]:
            self.api_running = False
        else:
            raise AssertionError(arguments)
        return subprocess.CompletedProcess(arguments, code, output, error)


class NginxReplacementTests(unittest.TestCase):
    def invoke(self, docker, output, *extra):
        arguments = [str(SCRIPT), "--project", "janamen-ci", "--output", str(output), *extra]
        with patch.object(sys, "argv", arguments), patch.object(runner.subprocess, "run", docker.run), \
                patch.object(runner, "wait_ready"), redirect_stdout(io.StringIO()):
            runner.main()

    def test_container_config_digest_is_not_used_as_probe_image(self):
        docker = DockerFixture()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "report.json"
            self.invoke(docker, output)
            report = json.loads(output.read_text())
        self.assertTrue(report["passed"])
        self.assertEqual(report["stage"], "complete")
        self.assertEqual(report["probe_image"], "sha256:local-image-index")
        self.assertEqual(report["api_origin"], "http://127.0.0.1:8010")
        self.assertEqual(report["web_origin"], "http://127.0.0.1:8090")
        self.assertEqual((report["old_api_ip"], report["new_api_ip"]), ("172.29.1.3", "172.29.1.5"))
        self.assertEqual(report["frontend_started_at_after"], report["frontend_started_at"])
        self.assertTrue(docker.api_running)
        self.assertFalse(docker.probe_running)

    def test_missing_local_image_does_not_stop_the_api(self):
        docker = DockerFixture(image_available=False)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "report.json"
            with self.assertRaisesRegex(RuntimeError, "No such image"):
                self.invoke(docker, output)
            self.assertFalse(output.exists())
        self.assertTrue(docker.api_running)
        self.assertEqual(docker.api_id, "old-api")
        self.assertFalse(any(call[1] in {"stop", "rm", "run"} for call in docker.calls))

    def test_reservation_failure_retains_failed_report_and_recovers_api(self):
        docker = DockerFixture(reservation_available=False)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "report.json"
            with self.assertRaisesRegex(RuntimeError, "Address already in use"):
                self.invoke(docker, output)
            report = json.loads(output.read_text())
        self.assertFalse(report["passed"])
        self.assertEqual(report["stage"], "hold_old_address")
        self.assertIn("Address already in use", report["error"])
        self.assertTrue(docker.api_running)
        self.assertEqual(docker.api_id, "new-api")
        self.assertFalse(docker.probe_running)

    def test_wrong_origin_is_rejected_before_mutation(self):
        docker = DockerFixture()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "report.json"
            with patch("sys.stderr", new=io.StringIO()), self.assertRaises(SystemExit) as error:
                self.invoke(docker, output, "--web-url", "http://127.0.0.1:8080")
            self.assertEqual(error.exception.code, 2)
            self.assertFalse(output.exists())
        self.assertTrue(docker.api_running)
        self.assertEqual(docker.api_id, "old-api")
        self.assertFalse(any(call[1] in {"stop", "rm", "run"} for call in docker.calls))


if __name__ == "__main__":
    unittest.main()
