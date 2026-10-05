import base64
import hashlib
import re
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from rest_framework import serializers

from .models import GenerationSettings


PROMPT_PATH = Path(settings.BASE_DIR) / "prompts" / "master-writer-prompt.md"


def defaults():
    return {
        "masterPrompt": PROMPT_PATH.read_text(encoding="utf-8") if PROMPT_PATH.exists() else "Write a practical article about money and online work.",
        "generationMode": "daily",
        "generationFrequency": "daily",
        "generationCount": 1,
        "generationTimes": ["08:00"],
        "generationTime": "08:00",
        "generationWeekdays": [1],
        "autoGenerationEnabled": False,
        "timezone": "Europe/Sofia",
        "openRouterModel": "meta-llama/llama-3.1-8b-instruct",
        "openRouterSiteUrl": "http://localhost:3000",
        "openRouterTimeoutMs": 90000,
        "openRouterMaxInputChars": 16000,
        "openRouterMaxOutputTokens": 9000,
        "openRouterTemperature": 0.7,
        "openRouterRetryAttempts": 3,
    }


def _cipher():
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
    return Fernet(key)


def api_key_for(row):
    if not row.encrypted_api_key:
        return ""
    try:
        return _cipher().decrypt(row.encrypted_api_key.encode()).decode()
    except InvalidToken as error:
        raise RuntimeError("Stored OpenRouter key cannot be decrypted; check DJANGO_SECRET_KEY") from error


def get_settings_row():
    row, _ = GenerationSettings.objects.get_or_create(pk=1, defaults={"data": defaults()})
    return row


def get_settings_data(row=None):
    row = row or get_settings_row()
    return {**defaults(), **(row.data or {})}


def public_settings(row=None):
    row = row or get_settings_row()
    return {
        **get_settings_data(row),
        "openRouterApiKey": "",
        "hasOpenRouterApiKey": bool(row.encrypted_api_key),
    }


class SettingsInputSerializer(serializers.Serializer):
    masterPrompt = serializers.CharField(required=False, allow_blank=False, max_length=100000)
    generationMode = serializers.ChoiceField(required=False, choices=["daily", "weekly"])
    generationFrequency = serializers.ChoiceField(required=False, choices=["daily", "weekly"])
    generationCount = serializers.IntegerField(required=False, min_value=1, max_value=12)
    generationTimes = serializers.ListField(required=False, child=serializers.CharField(), min_length=1, max_length=12)
    generationTime = serializers.CharField(required=False)
    generationWeekdays = serializers.ListField(required=False, child=serializers.IntegerField(min_value=0, max_value=6))
    autoGenerationEnabled = serializers.BooleanField(required=False)
    timezone = serializers.CharField(required=False, max_length=80)
    openRouterModel = serializers.CharField(required=False, max_length=200)
    openRouterSiteUrl = serializers.URLField(required=False)
    openRouterTimeoutMs = serializers.IntegerField(required=False, min_value=5000, max_value=180000)
    openRouterMaxInputChars = serializers.IntegerField(required=False, min_value=1000, max_value=100000)
    openRouterMaxOutputTokens = serializers.IntegerField(required=False, min_value=256, max_value=32000)
    openRouterTemperature = serializers.FloatField(required=False, min_value=0, max_value=2)
    openRouterRetryAttempts = serializers.IntegerField(required=False, min_value=1, max_value=5)
    openRouterApiKey = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True, write_only=True)
    clearOpenRouterApiKey = serializers.BooleanField(required=False, write_only=True)

    def validate(self, data):
        current = get_settings_data()
        merged = {**current, **data}
        mode = data.get("generationMode", data.get("generationFrequency", merged["generationMode"]))
        merged["generationMode"] = mode
        merged["generationFrequency"] = mode
        times = merged["generationTimes"]
        if not all(re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", str(value)) for value in times):
            raise serializers.ValidationError({"generationTimes": "Use 24-hour HH:MM times."})
        count = merged["generationCount"]
        if len(times) < count:
            raise serializers.ValidationError({"generationTimes": "Provide one time for each scheduled run."})
        merged["generationTimes"] = times[:count]
        merged["generationTime"] = times[0]
        merged["generationWeekdays"] = sorted(set(merged["generationWeekdays"]))
        if mode == "weekly" and not merged["generationWeekdays"]:
            raise serializers.ValidationError({"generationWeekdays": "Select at least one weekday."})
        try:
            ZoneInfo(merged["timezone"])
        except (ZoneInfoNotFoundError, ValueError):
            raise serializers.ValidationError({"timezone": "Enter a valid IANA timezone."})
        data["_merged"] = merged
        return data


def save_settings(validated):
    row = get_settings_row()
    data = validated["_merged"].copy()
    data.pop("openRouterApiKey", None)
    data.pop("clearOpenRouterApiKey", None)
    data.pop("hasOpenRouterApiKey", None)
    if validated.get("clearOpenRouterApiKey"):
        row.encrypted_api_key = ""
    elif validated.get("openRouterApiKey"):
        row.encrypted_api_key = _cipher().encrypt(validated["openRouterApiKey"].encode()).decode()
    row.data = data
    row.save()
    return public_settings(row)
