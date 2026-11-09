import io
import shutil
import tempfile
import uuid
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from .commerce import download_token
from .models import BookOrder


@override_settings(BOT_INTEGRATION_TOKEN="site-secret", SITE_URL="https://makemoneyordie.com")
class BotIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.media_root = tempfile.mkdtemp()
        self.external_id = str(uuid.uuid4())
        self.headers = {"HTTP_AUTHORIZATION": "Bearer site-secret"}
        self.payload = {
            "external_id": self.external_id,
            "title": "A bot article",
            "content": "<p>Article body</p>",
            "summary": "A summary",
            "category_slugs": ["news"],
            "author_slug": None,
            "tag_names": ["money"],
        }

    def tearDown(self):
        shutil.rmtree(self.media_root, ignore_errors=True)

    def test_image_upload_is_persistent_and_idempotent(self):
        self.client.post("/api/bot/v1/articles/", self.payload, format="json", **self.headers)
        image = io.BytesIO()
        Image.new("RGB", (2, 2), "red").save(image, format="PNG")
        image.seek(0)
        with override_settings(MEDIA_ROOT=self.media_root):
            response = self.client.put(
                f"/api/bot/v1/articles/{self.external_id}/image/",
                {"image": SimpleUploadedFile("cover.jpg", image.read(), content_type="image/jpeg")},
                format="multipart", **self.headers,
            )
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json()["image_url"].startswith("https://makemoneyordie.com/uploads/covers/"))
            image.seek(0)
            repeat = self.client.put(
                f"/api/bot/v1/articles/{self.external_id}/image/",
                {"image": SimpleUploadedFile("different.jpg", image.read(), content_type="image/jpeg")},
                format="multipart", **self.headers,
            )
            self.assertEqual(repeat.json()["image_url"], response.json()["image_url"])

    def test_auth_options_and_idempotent_create(self):
        self.assertEqual(self.client.get("/api/bot/v1/options/").status_code, 403)
        self.assertEqual(self.client.get("/api/bot/v1/options/", **self.headers).status_code, 200)
        first = self.client.post("/api/bot/v1/articles/", self.payload, format="json", **self.headers)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.json()["status"], "draft")
        self.assertEqual(self.client.post("/api/bot/v1/articles/", self.payload, format="json", **self.headers).status_code, 200)
        changed = {**self.payload, "content": "<p>Changed</p>"}
        self.assertEqual(self.client.post("/api/bot/v1/articles/", changed, format="json", **self.headers).status_code, 409)

    def test_publish_is_idempotent_and_image_is_locked_after_publish(self):
        self.client.post("/api/bot/v1/articles/", self.payload, format="json", **self.headers)
        publish_url = f"/api/bot/v1/articles/{self.external_id}/publish/"
        self.assertEqual(self.client.post(publish_url, {}, format="json", **self.headers).json()["status"], "published")
        self.assertEqual(self.client.post(publish_url, {}, format="json", **self.headers).status_code, 200)
        upload = io.BytesIO(b"not-an-image")
        response = self.client.put(
            f"/api/bot/v1/articles/{self.external_id}/image/",
            {"image": upload}, format="multipart", **self.headers,
        )
        self.assertEqual(response.status_code, 409)


class FakeStripeSession(dict):
    def __getattr__(self, name):
        return self[name]


@override_settings(
    STRIPE_SECRET_KEY="sk_test_example",
    STRIPE_WEBHOOK_SECRET="whsec_example",
    SITE_URL="https://makemoneyordie.com",
    BOOK_TITLE="Make Money or Die",
    BOOK_PRICE_CENTS=1900,
    BOOK_CURRENCY="eur",
    BOOK_DOWNLOAD_MAX_AGE=86400,
)
class BookCommerceTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @patch("content.commerce.stripe.checkout.Session.create")
    def test_checkout_creates_pending_order_and_uses_server_price(self, create_session):
        create_session.return_value = FakeStripeSession(id="cs_test_123", url="https://checkout.stripe.com/test")
        response = self.client.post("/api/book/checkout", {}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["data"]["checkoutUrl"], "https://checkout.stripe.com/test")
        order = BookOrder.objects.get()
        self.assertEqual(order.stripe_checkout_session_id, "cs_test_123")
        self.assertEqual(order.amount_total, 1900)
        kwargs = create_session.call_args.kwargs
        self.assertEqual(kwargs["line_items"][0]["price_data"]["unit_amount"], 1900)
        self.assertEqual(kwargs["metadata"]["book_order_id"], str(order.id))

    @patch("content.commerce_api.stripe.checkout.Session.retrieve")
    def test_paid_session_unlocks_download(self, retrieve_session):
        order = BookOrder.objects.create(
            stripe_checkout_session_id="cs_test_paid",
            amount_total=1900,
            currency="eur",
        )
        retrieve_session.return_value = FakeStripeSession(
            id="cs_test_paid",
            payment_status="paid",
            payment_intent="pi_test_paid",
            metadata={"book_order_id": str(order.id)},
            customer_details={"email": "reader@example.com"},
        )
        response = self.client.get("/api/book/order/cs_test_paid")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["status"], "paid")
        self.assertIn("/api/book/download/", response.json()["data"]["downloadUrl"])
        order.refresh_from_db()
        self.assertEqual(order.status, BookOrder.Status.PAID)
        self.assertEqual(order.customer_email, "reader@example.com")

    def test_signed_download_serves_only_paid_order(self):
        temp_dir = tempfile.mkdtemp()
        self.addCleanup(lambda: shutil.rmtree(temp_dir, ignore_errors=True))
        book_path = f"{temp_dir}/book.pdf"
        with open(book_path, "wb") as file:
            file.write(b"%PDF-1.4 test")
        paid = BookOrder.objects.create(
            stripe_checkout_session_id="cs_test_download",
            amount_total=1900,
            currency="eur",
            status=BookOrder.Status.PAID,
        )
        pending = BookOrder.objects.create(
            stripe_checkout_session_id="cs_test_pending",
            amount_total=1900,
            currency="eur",
        )
        with override_settings(BOOK_FILE_PATH=book_path):
            response = self.client.get(f"/api/book/download/{download_token(paid)}")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response["Content-Type"], "application/pdf")
            denied = self.client.get(f"/api/book/download/{download_token(pending)}")
            self.assertEqual(denied.status_code, 403)

    @patch("content.commerce_api.stripe.Webhook.construct_event")
    def test_webhook_fulfillment_is_idempotent(self, construct_event):
        order = BookOrder.objects.create(
            stripe_checkout_session_id="cs_test_webhook",
            amount_total=1900,
            currency="eur",
        )
        session = FakeStripeSession(
            id="cs_test_webhook",
            payment_status="paid",
            payment_intent="pi_test_webhook",
            metadata={"book_order_id": str(order.id)},
            customer_details={"email": "buyer@example.com"},
        )
        construct_event.return_value = {"type": "checkout.session.completed", "data": {"object": session}}
        for _ in range(2):
            response = self.client.post("/api/stripe/webhook", b"{}", content_type="application/json", HTTP_STRIPE_SIGNATURE="signed")
            self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, BookOrder.Status.PAID)
        self.assertIsNotNone(order.paid_at)
