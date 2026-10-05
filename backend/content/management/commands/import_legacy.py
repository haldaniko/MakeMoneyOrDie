"""Copy the former Node backend's PostgreSQL data into Django tables once."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import connection
from django.db import transaction

from content.generation_settings import defaults
from content.models import GenerationSettings, ImportMarker, Post, Subscriber


def table_exists(name):
    return name in connection.introspection.table_names()


def rows(name, columns):
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT {columns} FROM {connection.ops.quote_name(name)}")
        names = [column[0] for column in cursor.description]
        return [dict(zip(names, row)) for row in cursor.fetchall()]


class Command(BaseCommand):
    help = "Import posts, subscribers, settings, and admins from the previous Node backend."

    def handle(self, *args, **options):
        if ImportMarker.objects.filter(name="node_backend_v1").exists():
            self.stdout.write("Legacy import already completed")
            return
        with transaction.atomic():
            self._import()
            ImportMarker.objects.create(name="node_backend_v1")

    def _import(self):
        counts = {"posts": 0, "subscribers": 0, "admins": 0, "settings": 0}
        if table_exists("generated_posts"):
            for old in rows("generated_posts", "*"):
                post, created = Post.objects.get_or_create(
                    slug=old["slug"],
                    defaults={
                        "id": old["id"], "title": old["title"], "excerpt": old["excerpt"],
                        "content_html": old["content_html"], "status": old["status"],
                        "author": old["author"], "tags": list(old["tags"] or []),
                        "seo_title": old["seo_title"], "seo_description": old["seo_description"],
                        "cover_image": old["cover_image"], "source": old["source"],
                    },
                )
                if created:
                    Post.objects.filter(pk=post.pk).update(created_at=old["created_at"], updated_at=old["updated_at"])
                    counts["posts"] += 1
        if table_exists("subscribers"):
            for old in rows("subscribers", "email, created_at"):
                subscriber, created = Subscriber.objects.get_or_create(email=old["email"])
                if created:
                    Subscriber.objects.filter(pk=subscriber.pk).update(created_at=old["created_at"])
                    counts["subscribers"] += 1
        if table_exists("users"):
            User = get_user_model()
            for old in rows("users", "email, password_hash, role"):
                if old["role"] != "admin":
                    continue
                _, created = User.objects.get_or_create(
                    username=old["email"],
                    defaults={
                        "email": old["email"], "password": f"legacy_bcrypt${old['password_hash']}",
                        "is_staff": True, "is_superuser": True,
                    },
                )
                counts["admins"] += int(created)
        if table_exists("admin_settings") and not GenerationSettings.objects.exists():
            with connection.cursor() as cursor:
                cursor.execute("SELECT value FROM admin_settings WHERE key = %s", ["generation"])
                old = cursor.fetchone()
            if old:
                GenerationSettings.objects.create(pk=1, data={**defaults(), **old[0]})
                counts["settings"] = 1
        self.stdout.write(self.style.SUCCESS(f"Legacy import complete: {counts}"))
