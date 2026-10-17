import json
import os
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.identity.models import User
from apps.knowledge.evaluation import evaluate_knowledge


class Command(BaseCommand):
    help = "Run the synthetic knowledge regression cases against seeded users. Results do not prove live provider quality."

    def add_arguments(self, parser):
        parser.add_argument("--employee", default="employee.demo")
        parser.add_argument("--hr", default="hr.demo")
        parser.add_argument("--output")

    def handle(self, *args, **options):
        if os.getenv("KNOWLEDGE_GENERATION_PROVIDER", "extractive") != "extractive":
            raise CommandError(
                "Set KNOWLEDGE_GENERATION_PROVIDER=extractive for this lexical regression suite. Live provider evaluation is a separate gate."
            )
        users = {}
        for role in ("employee", "hr"):
            user = User.objects.filter(username=options[role], is_active=True, role=role).first()
            if user is None:
                raise CommandError(
                    f"Seed or supply an active {role} username before running this evaluation."
                )
            users[role] = user
        result = evaluate_knowledge(users)
        encoded = json.dumps(result, ensure_ascii=False, indent=2)
        if options["output"]:
            Path(options["output"]).write_text(encoded + "\n")
        self.stdout.write(encoded)
        if result["passed"] != result["total"]:
            raise CommandError("Knowledge regression failures are listed above.")
