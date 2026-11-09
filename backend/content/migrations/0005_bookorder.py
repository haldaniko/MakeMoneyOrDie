import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("content", "0004_alter_post_source")]

    operations = [
        migrations.CreateModel(
            name="BookOrder",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("stripe_checkout_session_id", models.CharField(blank=True, max_length=255, null=True, unique=True)),
                ("stripe_payment_intent_id", models.CharField(blank=True, max_length=255)),
                ("customer_email", models.EmailField(blank=True, max_length=254)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("paid", "Paid")], default="pending", max_length=12)),
                ("amount_total", models.PositiveIntegerField()),
                ("currency", models.CharField(max_length=3)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
