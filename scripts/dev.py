#!/usr/bin/env python3
import argparse
import os
import secrets
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def prepare():
    destination = ROOT / ".env"
    if destination.exists():
        print("Existing local configuration retained.")
        return
    template = (ROOT / ".env.example").read_text()
    for name in ("DJANGO_SECRET_KEY", "POSTGRES_PASSWORD", "DEMO_PASSWORD"):
        template = template.replace(f"{name}=\n", f"{name}={secrets.token_urlsafe(36)}\n")
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as output:
        output.write(template)
    print("Local configuration created. Demo credentials are stored in .env and excluded from Git.")


def compose(arguments):
    if not shutil.which("docker"):
        raise SystemExit("Docker is unavailable. Use the native backend instructions in README.md.")
    subprocess.run(["docker", "compose", *arguments], cwd=ROOT, check=True)


def main():
    parser = argparse.ArgumentParser(description="JanaMen local environment commands")
    parser.add_argument("command", choices=["prepare", "up", "down", "test-postgres", "credentials"])
    args = parser.parse_args()
    if args.command in {"prepare", "up", "test-postgres"}:
        prepare()
    if args.command == "up":
        compose(["up", "--build", "-d"])
    elif args.command == "down":
        compose(["down"])
    elif args.command == "test-postgres":
        compose(["--profile", "test", "run", "--build", "--rm", "test"])
    elif args.command == "credentials":
        path = ROOT / ".env"
        if not path.exists():
            raise SystemExit("Run python scripts/dev.py prepare first.")
        line = next((line for line in path.read_text().splitlines() if line.startswith("DEMO_PASSWORD=")), None)
        if not line or not line.partition("=")[2]:
            raise SystemExit("DEMO_PASSWORD is missing from the local configuration.")
        print("Local synthetic accounts only. See README.md for their usernames.")
        print(line)


if __name__ == "__main__":
    main()
