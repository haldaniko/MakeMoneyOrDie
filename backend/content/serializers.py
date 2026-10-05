import bleach
from django.utils.text import slugify
from rest_framework import serializers

from .models import Post


ALLOWED_TAGS = set(bleach.sanitizer.ALLOWED_TAGS) | {
    "p", "br", "h1", "h2", "h3", "h4", "figure", "figcaption", "img", "span", "div"
}
ALLOWED_ATTRIBUTES = {
    "a": ["href", "name", "target", "rel"],
    "img": ["src", "alt", "title", "width", "height", "loading"],
    "*": ["class"],
}


def sanitize_article_html(value):
    return bleach.clean(
        value,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=["http", "https", "mailto"],
        strip=True,
    )


class PostSerializer(serializers.ModelSerializer):
    contentHtml = serializers.CharField(source="content_html")
    seoTitle = serializers.CharField(source="seo_title", allow_blank=True, allow_null=True, required=False)
    seoDescription = serializers.CharField(source="seo_description", allow_blank=True, allow_null=True, required=False)
    coverImage = serializers.CharField(source="cover_image", allow_blank=True, allow_null=True, required=False)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    tags = serializers.ListField(child=serializers.CharField(max_length=100), required=False)
    slug = serializers.CharField(required=False, allow_blank=True, max_length=255)

    class Meta:
        model = Post
        fields = [
            "id", "slug", "title", "excerpt", "contentHtml", "status", "author", "tags",
            "seoTitle", "seoDescription", "coverImage", "source", "createdAt", "updatedAt",
        ]
        read_only_fields = ["id", "source", "createdAt", "updatedAt"]

    def validate_contentHtml(self, value):
        cleaned = sanitize_article_html(value)
        if not bleach.clean(cleaned, tags=[], strip=True).strip():
            raise serializers.ValidationError("Article content is required.")
        return cleaned

    def validate(self, attrs):
        title = attrs.get("title", self.instance.title if self.instance else "")
        slug = slugify(attrs.get("slug") or title)
        if not slug:
            raise serializers.ValidationError({"slug": "A valid title or slug is required."})
        attrs["slug"] = slug[:255]
        if Post.objects.filter(slug=attrs["slug"]).exclude(pk=self.instance.pk if self.instance else None).exists():
            raise serializers.ValidationError({"slug": "This slug is already used."})
        return attrs
