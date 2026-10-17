import json
import os
import secrets
from contextlib import suppress
from importlib import import_module
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.identity.seed import seed_identity


class Command(BaseCommand):
    help = (
        "Create or extend synthetic demo fixtures without overwriting existing accounts or records."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--credentials-file",
            default=str(settings.BASE_DIR.parent / "runtime" / "demo-credentials.json"),
        )
        parser.add_argument("--skip-requests", action="store_true")
        parser.add_argument("--skip-academy", action="store_true")
        parser.add_argument("--skip-knowledge", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG and os.getenv("DEMO_SEED", "false").lower() != "true":
            raise CommandError("Synthetic seeding outside DEBUG requires DEMO_SEED=true.")
        requested_path = Path(options["credentials_file"]).expanduser()
        if requested_path.is_symlink():
            raise CommandError(
                "The credentials output must be a regular file, not a symbolic link."
            )
        path = requested_path.resolve()
        previous = {}
        if path.exists():
            try:
                saved = json.loads(path.read_text())
                previous = {item["username"]: item for item in saved["accounts"]}
            except (OSError, ValueError, KeyError, TypeError) as error:
                raise CommandError(
                    "The existing credentials file is invalid; it was preserved."
                ) from error
        password = (
            os.getenv("DEMO_PASSWORD")
            or previous.get("employee.demo", {}).get("password")
            or secrets.token_urlsafe(24)
        )
        try:
            validate_password(password)
        except ValidationError as error:
            raise CommandError(
                "DEMO_PASSWORD does not satisfy the configured password policy."
            ) from error
        results = {}
        with transaction.atomic():
            employees = seed_identity(password=password)
            for module, method, arguments in [
                ("hr_requests", "seed_requests", (employees,)),
                ("academy", "seed_academy", (employees,)),
                ("knowledge", "seed_knowledge", ()),
            ]:
                option = "skip_requests" if module == "hr_requests" else f"skip_{module}"
                if options[option] or not apps.is_installed(f"apps.{module}"):
                    results[module] = "skipped"
                    continue
                seed_module = import_module(f"apps.{module}.seed")
                result = getattr(seed_module, method)(*arguments)
                results[module] = len(result) if isinstance(result, list | tuple) else "complete"
        accounts = []
        for employee in employees:
            user = employee.user
            old_password = previous.get(user.username, {}).get("password")
            known_password = (
                password
                if user.check_password(password)
                else old_password
                if isinstance(old_password, str) and user.check_password(old_password)
                else None
            )
            accounts.append(
                {
                    "username": user.username,
                    "role": user.role,
                    "employee_id": str(employee.pk),
                    "full_name": employee.full_name,
                    "password": known_password,
                    "credential_status": "available"
                    if known_password
                    else "existing_password_preserved_unknown",
                }
            )
        document = {
            "schema_version": 1,
            "synthetic": True,
            "generated_at": timezone.now().isoformat(),
            "modules": results,
            "accounts": accounts,
        }
        temporary = path.with_name(f".{path.name}.{secrets.token_hex(6)}.tmp")
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "w") as stream:
                json.dump(document, stream, ensure_ascii=False, indent=2)
                stream.write("\n")
            os.replace(temporary, path)
        except OSError as error:
            with suppress(OSError):
                temporary.unlink(missing_ok=True)
            raise CommandError(
                "Demo seeding was rolled back because the credentials file could not be written. Existing records and passwords were preserved."
            ) from error
        self.stdout.write(
            self.style.SUCCESS(
                f"Synthetic fixtures ready: {len(employees)} employees. Credentials: {path}"
            )
        )
        self.stdout.write(f"Modules: {json.dumps(results, ensure_ascii=False)}")
