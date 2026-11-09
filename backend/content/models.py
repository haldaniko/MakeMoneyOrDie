import uuid

from django.conf import settings
from django.db import models


class Post(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    class Source(models.TextChoices):
        ADMIN = "admin", "Admin"
        AI = "ai", "AI"
        LEGACY = "legacy", "Legacy"
        BOT = "bot", "Bot"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    external_id = models.UUIDField(null=True, blank=True, unique=True, editable=False)
    slug = models.SlugField(max_length=255, unique=True)
    title = models.CharField(max_length=500)
    excerpt = models.TextField()
    content_html = models.TextField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PUBLISHED)
    author = models.CharField(max_length=200, default="Editorial team")
    tags = models.JSONField(default=list)
    seo_title = models.CharField(max_length=80, null=True, blank=True)
    seo_description = models.CharField(max_length=180, null=True, blank=True)
    cover_image = models.CharField(max_length=500, null=True, blank=True)
    source = models.CharField(max_length=12, choices=Source.choices, default=Source.ADMIN)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]


class Subscriber(models.Model):
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)


class BookOrder(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stripe_checkout_session_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True)
    customer_email = models.EmailField(blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    amount_total = models.PositiveIntegerField()
    currency = models.CharField(max_length=3)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class GenerationSettings(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    data = models.JSONField(default=dict)
    encrypted_api_key = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class RefreshSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    token_hash = models.CharField(max_length=64, unique=True)
    csrf_token = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)


class AuditEvent(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    actor_email = models.EmailField(blank=True)
    event_type = models.CharField(max_length=80)
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)


class GenerationRun(models.Model):
    run_key = models.CharField(max_length=80, unique=True)
    status = models.CharField(max_length=16, default="running")
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)


class ImportMarker(models.Model):
    name = models.CharField(max_length=80, primary_key=True)
    completed_at = models.DateTimeField(auto_now_add=True)
