import os
from pathlib import Path

import dj_database_url


BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError("DJANGO_SECRET_KEY is required when DJANGO_DEBUG=0")
    SECRET_KEY = "development-only-change-this-secret-before-production"

ALLOWED_HOSTS = [host.strip() for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,backend").split(",") if host.strip()]
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if origin.strip()]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "content",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.debug",
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
WSGI_APPLICATION = "config.wsgi.application"

if os.getenv("PGHOST"):
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql",
        "HOST": os.environ["PGHOST"],
        "PORT": os.getenv("PGPORT", "5432"),
        "NAME": os.environ["PGDATABASE"],
        "USER": os.environ["PGUSER"],
        "PASSWORD": os.environ["PGPASSWORD"],
        "CONN_MAX_AGE": 600,
        "CONN_HEALTH_CHECKS": True,
    }}
else:
    DATABASES = {
        "default": dj_database_url.config(
            default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
            conn_max_age=600,
            conn_health_checks=True,
        )
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "content.auth.LegacyBCryptPasswordHasher",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["content.auth.BearerAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "EXCEPTION_HANDLER": "content.api.api_exception_handler",
    "DEFAULT_THROTTLE_RATES": {"auth": "20/min", "newsletter": "20/hour"},
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Europe/Sofia"
USE_I18N = True
USE_TZ = True
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads")))
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
APPEND_SLASH = False
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
