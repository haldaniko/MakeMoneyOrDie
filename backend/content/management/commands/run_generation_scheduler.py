import logging
import time
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand
from django.db import IntegrityError
from django.utils import timezone

from content.audit import audit
from content.generation import generate_and_store_articles
from content.generation_settings import get_settings_data
from content.models import GenerationRun


logger = logging.getLogger(__name__)


def run_due_generation(now=None):
    options = get_settings_data()
    if not options["autoGenerationEnabled"]:
        return False
    current = (now or timezone.now()).astimezone(ZoneInfo(options["timezone"]))
    weekday = (current.weekday() + 1) % 7
    if options["generationMode"] == "weekly" and weekday not in options["generationWeekdays"]:
        return False
    hhmm = current.strftime("%H:%M")
    if hhmm not in options["generationTimes"][:options["generationCount"]]:
        return False
    run_key = f"{current.date().isoformat()}-{hhmm}-{options['timezone']}"
    try:
        run = GenerationRun.objects.create(run_key=run_key)
    except IntegrityError:
        return False
    try:
        posts = generate_and_store_articles(1)
        run.status = "success"
        audit("generation_scheduled", metadata={"runKey": run_key, "postId": str(posts[0].id)})
    except Exception as error:
        run.status = "failed"
        run.error = str(error)[:2000]
        logger.exception("Scheduled generation failed")
    finally:
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "error", "finished_at"])
    return True


class Command(BaseCommand):
    help = "Run scheduled article generation using settings from the frontend admin panel."

    def handle(self, *args, **options):
        self.stdout.write("Generation scheduler started")
        while True:
            try:
                run_due_generation()
            except Exception:
                logger.exception("Generation scheduler tick failed")
            time.sleep(20)
