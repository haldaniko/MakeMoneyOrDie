import hashlib
import hmac
import uuid

import bleach
from django.conf import settings
from django.db import IntegrityError, transaction
from django.http import Http404
from django.utils.text import slugify
from rest_framework import parsers, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .media import save_bot_cover
from .models import Post
from .serializers import sanitize_article_html


SITE_ID = "makemoneyordie"
CATEGORY = {"slug": "news", "name": "News"}


class BotIntegrationPermission(permissions.BasePermission):
    message = "Invalid bot integration token."

    def has_permission(self, request, view):
        expected = getattr(settings, "BOT_INTEGRATION_TOKEN", "")
        supplied = request.headers.get("Authorization", "")
        actual = supplied[7:] if supplied.startswith("Bearer ") else ""
        return bool(expected) and bool(actual) and hmac.compare_digest(actual, expected)


def absolute_url(path):
    return f"{settings.SITE_URL}{path}"


def article_url(post):
    return absolute_url(f"/articles/{post.slug}")


def image_url(post):
    if not post.cover_image:
        return None
    return absolute_url(post.cover_image if post.cover_image.startswith("/") else f"/{post.cover_image}")


def article_result(post):
    return {
        "article_id": str(post.id),
        "status": post.status,
        "url": article_url(post),
        "image_url": image_url(post),
    }


def payload_fingerprint(payload):
    canonical = "\x1f".join([
        payload["title"], payload["content_html"], payload["summary"],
        ",".join(payload["category_slugs"]), payload.get("author_slug") or "",
        ",".join(payload["tag_names"]),
    ])
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def post_fingerprint(post):
    tags = list(post.tags or [])
    return payload_fingerprint({
        "title": post.title,
        "content_html": post.content_html,
        "summary": post.excerpt,
        "category_slugs": ["news"],
        "author_slug": None,
        "tag_names": [tag for tag in tags if tag != "news"],
    })


class BotView(APIView):
    permission_classes = [BotIntegrationPermission]
    authentication_classes = []


class BotOptionsView(BotView):
    def get(self, request):
        return Response({"version": 1, "site": SITE_ID, "categories": [CATEGORY], "authors": []})


class BotArticlesView(BotView):
    def post(self, request):
        external_id = request.data.get("external_id")
        try:
            external_uuid = uuid.UUID(str(external_id))
        except (ValueError, AttributeError, TypeError):
            return Response({"error": "external_id must be a UUID."}, status=status.HTTP_400_BAD_REQUEST)

        title = request.data.get("title")
        content = request.data.get("content")
        summary = request.data.get("summary") or ""
        categories = request.data.get("category_slugs")
        author = request.data.get("author_slug")
        tags = request.data.get("tag_names") or []
        if not isinstance(title, str) or not title.strip() or len(title) > 300:
            return Response({"error": "title is required and must be at most 300 characters."}, status=400)
        if not isinstance(content, str) or not bleach.clean(content, tags=[], strip=True).strip():
            return Response({"error": "content is required."}, status=400)
        if not isinstance(summary, str) or len(summary) > 1000:
            return Response({"error": "summary must be at most 1000 characters."}, status=400)
        if categories != ["news"]:
            return Response({"error": "category_slugs must contain the news category."}, status=400)
        if author not in (None, ""):
            return Response({"error": "author_slug is not supported by this site."}, status=400)
        if not isinstance(tags, list) or len(tags) > 10 or any(not isinstance(tag, str) or len(tag) > 80 for tag in tags):
            return Response({"error": "tag_names must contain at most 10 tags of 80 characters each."}, status=400)

        clean_content = sanitize_article_html(content)
        payload = {"title": title.strip(), "content_html": clean_content, "summary": summary, "category_slugs": ["news"], "author_slug": None, "tag_names": tags}
        try:
            with transaction.atomic():
                existing = Post.objects.select_for_update().filter(external_id=external_uuid).first()
                if existing:
                    if post_fingerprint(existing) != payload_fingerprint(payload):
                        return Response({"error": "external_id already exists with a different payload."}, status=409)
                    return Response(article_result(existing), status=200)
                post = Post.objects.create(
                    external_id=external_uuid,
                    slug=f"{slugify(title)[:220]}-{str(external_uuid)[:8]}",
                    title=payload["title"], excerpt=summary, content_html=clean_content,
                    status=Post.Status.DRAFT, author="Editorial team", tags=["news", *tags],
                    source="bot",
                )
        except IntegrityError:
            existing = Post.objects.filter(external_id=external_uuid).first()
            if existing and post_fingerprint(existing) == payload_fingerprint(payload):
                return Response(article_result(existing), status=200)
            return Response({"error": "external_id already exists with a different payload."}, status=409)
        return Response(article_result(post), status=201)


class BotArticleView(BotView):
    def _get(self, external_id, lock=False):
        query = Post.objects
        if lock:
            query = query.select_for_update()
        post = query.filter(external_id=external_id).first()
        if not post:
            raise Http404("Article not found.")
        return post

    def get(self, request, external_id):
        return Response(article_result(self._get(external_id)))


class BotPublishView(BotView):
    def post(self, request, external_id):
        with transaction.atomic():
            post = Post.objects.select_for_update().filter(external_id=external_id).first()
            if not post:
                raise Http404("Article not found.")
            if post.status == Post.Status.PUBLISHED:
                return Response(article_result(post))
            if post.status != Post.Status.DRAFT:
                return Response({"error": "Article is not publishable."}, status=409)
            post.status = Post.Status.PUBLISHED
            post.save(update_fields=["status", "updated_at"])
        return Response(article_result(post))


class BotArticleImageView(BotView):
    parser_classes = [parsers.MultiPartParser]

    def put(self, request, external_id):
        with transaction.atomic():
            post = Post.objects.select_for_update().filter(external_id=external_id).first()
            if not post:
                raise Http404("Article not found.")
            if post.status != Post.Status.DRAFT:
                return Response({"error": "Published articles cannot be changed."}, status=409)
            if post.cover_image:
                return Response(article_result(post))
            uploaded = request.FILES.get("image")
            if not uploaded:
                return Response({"error": "image file is required."}, status=400)
            try:
                asset = save_bot_cover(uploaded)
            except serializers.ValidationError as exc:
                return Response({"error": str(exc.detail)}, status=400)
            post.cover_image = asset["url"]
            post.save(update_fields=["cover_image", "updated_at"])
        return Response(article_result(post))
