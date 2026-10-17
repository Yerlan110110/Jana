import json

from django.core.management.base import BaseCommand
from django.core.serializers.json import DjangoJSONEncoder

from apps.academy.seed import seed_manifest


class Command(BaseCommand):
    help = "Report current synthetic Academy counts without changing any course or learner result."

    def handle(self, *args, **options):
        self.stdout.write(
            json.dumps(seed_manifest(), cls=DjangoJSONEncoder, ensure_ascii=False, indent=2)
        )
