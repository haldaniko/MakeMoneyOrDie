import base64
import binascii
import io
import re
import secrets
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.utils.text import slugify
from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError


FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp", "GIF": "gif"}
MAX_IMAGE_BYTES = 6 * 1024 * 1024


def cover_directory():
    directory = Path(settings.MEDIA_ROOT) / "covers"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def valid_name(name):
    return bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpg|png|webp|gif)", name))


def asset_info(path):
    stat = path.stat()
    return {
        "name": path.name,
        "url": f"/uploads/covers/{path.name}",
        "size": stat.st_size,
        "createdAt": datetime.fromtimestamp(stat.st_ctime, timezone.utc).isoformat(),
    }


def list_covers():
    return sorted(
        [asset_info(path) for path in cover_directory().iterdir() if path.is_file() and valid_name(path.name)],
        key=lambda item: item["createdAt"],
        reverse=True,
    )


def save_cover(file_name, data_url):
    match = re.fullmatch(r"data:image/(?:jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)", data_url or "", re.I)
    if not match:
        raise ValidationError("Upload must be a JPG, PNG, WEBP, or GIF image data URL.")
    try:
        raw = base64.b64decode(match.group(1), validate=True)
    except binascii.Error as error:
        raise ValidationError("Image data is invalid.") from error
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise ValidationError("Image must be non-empty and 6 MB or smaller.")
    try:
        with Image.open(io.BytesIO(raw)) as image:
            image.verify()
            extension = FORMATS.get(image.format)
    except (UnidentifiedImageError, OSError) as error:
        raise ValidationError("Image data is invalid.") from error
    if not extension:
        raise ValidationError("Unsupported image format.")
    base_name = slugify(Path(file_name or "cover-image").stem) or "cover-image"
    name = f"{base_name}-{secrets.token_hex(8)}.{extension}"
    path = cover_directory() / name
    path.write_bytes(raw)
    return asset_info(path)


def delete_cover(name):
    if not valid_name(name):
        raise ValidationError("Invalid image name.")
    path = cover_directory() / name
    if not path.is_file():
        raise Http404("Image not found.")
    path.unlink()


def serve_cover(request, name):
    if not valid_name(name):
        raise Http404("Image not found.")
    path = cover_directory() / name
    if not path.is_file():
        raise Http404("Image not found.")
    response = FileResponse(path.open("rb"))
    response["Cache-Control"] = "public, max-age=2592000"
    return response
