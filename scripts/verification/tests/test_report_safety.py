import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


RUNNER = Path(__file__).resolve().parents[1] / "smoke_workflows.py"


class ReportSafetyTests(unittest.TestCase):
    def run_command(self, credentials, output, timeout):
        return subprocess.run(
            [
                sys.executable,
                str(RUNNER),
                "--base-url",
                "http://127.0.0.1:1",
                "--credentials-file",
                str(credentials),
                "--output",
                str(output),
                "--request-timeout",
                str(timeout),
            ],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )

    def test_argument_failure_cannot_replace_credentials_through_any_alias(self):
        for alias in ("same", "symlink", "hardlink", "parent_symlink"):
            for timeout in (0, 20):
                with self.subTest(alias=alias, timeout=timeout), tempfile.TemporaryDirectory() as name:
                    root = Path(name)
                    credentials = root / "credentials.json"
                    original = b'{"synthetic": true, "accounts": []}\n'
                    credentials.write_bytes(original)
                    output = credentials if alias == "same" else root / "report.json"
                    if alias == "symlink":
                        output.symlink_to(credentials)
                    elif alias == "hardlink":
                        os.link(credentials, output)
                    elif alias == "parent_symlink":
                        directory = root / "alias"
                        directory.symlink_to(root, target_is_directory=True)
                        output = directory / credentials.name
                    result = self.run_command(credentials, output, timeout)
                    self.assertEqual(result.returncode, 2)
                    self.assertEqual(credentials.read_bytes(), original)
                    self.assertNotIn("Traceback", result.stderr)

    def test_safe_failure_report_preserves_original_credentials(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            credentials = root / "credentials.json"
            original = b'{"synthetic": true, "accounts": []}\n'
            credentials.write_bytes(original)
            output = root / "report.json"
            result = self.run_command(credentials, output, 0)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(credentials.read_bytes(), original)
            report = json.loads(output.read_text())
            self.assertEqual(report["failure"]["check"], "bounded_time_arguments_required")
            self.assertEqual(report["http_request_count"], 0)
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)


if __name__ == "__main__":
    unittest.main()
