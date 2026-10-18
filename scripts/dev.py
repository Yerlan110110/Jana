#!/usr/bin/env python3
import argparse
import os
import secrets
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def prepare(destination):
    if destination.exists():
        print("Existing local configuration retained.")
        return
    template = (ROOT / ".env.example").read_text()
    for name in ("DJANGO_SECRET_KEY", "POSTGRES_PASSWORD", "DEMO_PASSWORD"):
        length = 48 if name == "DJANGO_SECRET_KEY" else 36
        template = template.replace(f"{name}=\n", f"{name}={secrets.token_urlsafe(length)}\n")
    descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as output:
        output.write(template)
    print(f"Local configuration created at {destination}. Keep it private.")


def compose(arguments, env_file):
    if not shutil.which("docker"):
        raise SystemExit("Docker is unavailable. Use the native backend instructions in README.md.")
    subprocess.run(["docker", "compose", "--env-file", str(env_file), *arguments], cwd=ROOT, check=True)


def main():
    parser = argparse.ArgumentParser(description="JanaMen local environment commands")
    parser.add_argument("command", choices=["prepare", "up", "down", "test-postgres", "credentials"])
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    args = parser.parse_args()
    env_file = (ROOT / args.env_file).resolve()
    if env_file != ROOT / ".env" and not env_file.is_relative_to(ROOT / ".artifacts"):
        parser.error("Keep runtime configuration in the project .env or .artifacts directory")
    if args.command in {"prepare", "up", "test-postgres"}:
        prepare(env_file)
    if args.command == "up":
        compose(["up", "--build", "-d"], env_file)
    elif args.command == "down":
        compose(["down"], env_file)
    elif args.command == "test-postgres":
        compose(["--profile", "test", "run", "--build", "--rm", "test"], env_file)
    elif args.command == "credentials":
        path = env_file
        if not path.exists():
            raise SystemExit("Run python scripts/dev.py prepare first.")
        line = next((line for line in path.read_text().splitlines() if line.startswith("DEMO_PASSWORD=")), None)
        if not line or not line.partition("=")[2]:
            raise SystemExit("DEMO_PASSWORD is missing from the local configuration.")
        print("Local synthetic accounts only. See README.md for their usernames.")
        print(line)


if __name__ == "__main__":
    main()
