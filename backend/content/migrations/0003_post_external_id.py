from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("content", "0002_importmarker")]

    operations = [
        migrations.AddField(
            model_name="post",
            name="external_id",
            field=models.UUIDField(blank=True, editable=False, null=True, unique=True),
        ),
    ]
