import hashlib
import secrets
from datetime import timedelta

import bcrypt
import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import BasePasswordHasher
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import RefreshSession


ACCESS_MINUTES = 15
REFRESH_DAYS = 30
REFRESH_COOKIE = "refresh_token"


class LegacyBCryptPasswordHasher(BasePasswordHasher):
    algorithm = "legacy_bcrypt"

    def encode(self, password, salt):
        raise NotImplementedError("Legacy passwords are verified and upgraded on login only")

    def verify(self, password, encoded):
        try:
            stored_hash = encoded.split("$", 1)[1].encode("ascii")
            return bcrypt.checkpw(password.encode("utf-8"), stored_hash)
        except (IndexError, ValueError, UnicodeError):
            return False

    def safe_summary(self, encoded):
        return {"algorithm": self.algorithm, "hash": "<legacy bcrypt hash>"}


def create_access_token(user):
    now = timezone.now()
    return jwt.encode(
        {"sub": str(user.pk), "iat": now, "exp": now + timedelta(minutes=ACCESS_MINUTES)},
        settings.SECRET_KEY,
        algorithm="HS256",
    )


class BearerAuthentication(BaseAuthentication):
    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header:
            return None
        if not header.startswith("Bearer "):
            raise AuthenticationFailed("Admin session required")
        try:
            payload = jwt.decode(header[7:], settings.SECRET_KEY, algorithms=["HS256"])
            user = get_user_model().objects.get(pk=payload["sub"], is_active=True)
        except (jwt.PyJWTError, KeyError, ValueError, get_user_model().DoesNotExist):
            raise AuthenticationFailed("Session expired. Please sign in again.")
        return user, None

    def authenticate_header(self, request):
        return "Bearer"


def issue_refresh_session(user):
    token = secrets.token_urlsafe(48)
    csrf_token = secrets.token_urlsafe(24)
    RefreshSession.objects.create(
        user=user,
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        csrf_token=csrf_token,
        expires_at=timezone.now() + timedelta(days=REFRESH_DAYS),
    )
    return token, csrf_token


def get_refresh_session(token, csrf_token):
    if not token or not csrf_token:
        return None
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    session = RefreshSession.objects.select_related("user").filter(
        token_hash=token_hash, expires_at__gt=timezone.now(), user__is_active=True
    ).first()
    if not session or not secrets.compare_digest(session.csrf_token, csrf_token):
        return None
    return session


def delete_refresh_session(token):
    if token:
        RefreshSession.objects.filter(token_hash=hashlib.sha256(token.encode()).hexdigest()).delete()


def set_refresh_cookie(response, token):
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=REFRESH_DAYS * 86400,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Strict",
        path="/api/auth",
    )


def user_payload(user):
    return {"id": str(user.pk), "email": user.email, "role": "admin"}
