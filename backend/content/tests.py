import io
import shutil
import tempfile
import uuid

from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile


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
