from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("content", "0003_post_external_id")]

    operations = [
        migrations.AlterField(
            model_name="post",
            name="source",
            field=models.CharField(
                choices=[
                    ("admin", "Admin"),
                    ("ai", "AI"),
                    ("legacy", "Legacy"),
                    ("bot", "Bot"),
                ],
                default="admin",
                max_length=12,
            ),
        ),
    ]
