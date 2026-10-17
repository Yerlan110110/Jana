"""Run the existing browser tests in an owned Chrome profile at native zoom."""

import argparse
import json
import math
import os
import subprocess
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chrome", type=Path, required=True)
    parser.add_argument("--factor", type=int, choices=[1, 2], required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--config", default="e2e.zoom-probe.config.ts")
    args = parser.parse_args()
    args.output.mkdir(parents=True, mode=0o700, exist_ok=False)
    profile = (args.output / "profile").resolve()
    (profile / "Default").mkdir(parents=True, mode=0o700)
    preferences = {"partition": {"default_zoom_level": {"x": math.log(args.factor) / math.log(1.2)}}}
    (profile / "Default" / "Preferences").write_text(json.dumps(preferences))
    with (args.output / "chrome.log").open("xb") as log:
        process = subprocess.Popen([
            str(args.chrome), "--headless=new", "--remote-debugging-address=127.0.0.1",
            "--remote-debugging-port=0", f"--user-data-dir={profile}", "--window-size=1280,800",
            "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "about:blank",
        ], stdout=log, stderr=log, start_new_session=True)
        owner = {
            "pid": process.pid, "profile": str(profile), "factor": args.factor,
            "test_exit_code": None,
            "purpose": "Native zoom verification against the synthetic app",
            "cleanup": "Chrome stops in finally. Retain the private profile until the evidence is reviewed, then remove this owned disposable profile.",
        }
        (args.output / "owner.json").write_text(json.dumps(owner, indent=2) + "\n")
        try:
            port_file = profile / "DevToolsActivePort"
            deadline = time.monotonic() + 15
            while not port_file.exists():
                if process.poll() is not None or time.monotonic() >= deadline:
                    raise RuntimeError(f"Owned Chrome did not become ready; see {args.output / 'chrome.log'}")
                time.sleep(0.1)
            port = int(port_file.read_text().splitlines()[0])
            environment = {
                **os.environ, "JANAMEN_ZOOM_CDP": f"http://127.0.0.1:{port}",
                "JANAMEN_ZOOM_FACTOR": str(args.factor), "E2E_TELEMETRY_DISABLED": "1",
                "JANAMEN_CAPTURE_ROOT": str(args.output / "captures"),
            }
            result = subprocess.run([
                "npx", "e2e", "run", "--config", args.config, "--trace", "on",
                "--output", str(args.output / "report"),
            ], env=environment)
            owner["test_exit_code"] = result.returncode
            return result.returncode
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=20)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=10)
            owner["chrome_exit_code"] = process.returncode
            owner["stopped"] = process.poll() is not None
            (args.output / "owner.json").write_text(json.dumps(owner, indent=2) + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
