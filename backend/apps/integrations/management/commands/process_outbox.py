import time

from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections

from apps.integrations.worker import process_once


class Command(BaseCommand):
    help = "Deliver due outbox messages through the configured mock adapter."

    def add_arguments(self, parser):
        parser.add_argument("--watch", action="store_true")
        parser.add_argument("--poll-interval", type=float, default=1.0)
        parser.add_argument("--max-messages", type=int, default=None)

    def handle(self, *args, **options):
        interval = options["poll_interval"]
        limit = options["max_messages"]
        if not 0.05 <= interval <= 30:
            raise CommandError("Use a poll interval between 0.05 and 30 seconds.")
        if limit is not None and limit < 1:
            raise CommandError("Use a positive maximum message count.")
        count = 0
        try:
            while limit is None or count < limit:
                close_old_connections()
                if process_once():
                    count += 1
                elif not options["watch"]:
                    break
                else:
                    time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write("Worker stopped. Unacknowledged claims remain recoverable.")
        self.stdout.write(f"Outbox messages attempted: {count}")
