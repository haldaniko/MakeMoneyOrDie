import json
import logging
import random
import re
import uuid

import requests
from django.utils.text import slugify
from rest_framework.exceptions import APIException, ValidationError

from .generation_settings import api_key_for, get_settings_data, get_settings_row
from .media import list_covers
from .models import Post
from .serializers import PostSerializer


logger = logging.getLogger(__name__)


class GenerationFailed(APIException):
    status_code = 502
    default_detail = "Article generation failed. Check your OpenRouter settings and try again."


def _parse_json(content):
    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    raw = str(content or "").strip()
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.IGNORECASE)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        decoder = json.JSONDecoder()
        for index, character in enumerate(raw):
            if character in "{[":
                try:
                    value, _ = decoder.raw_decode(raw[index:])
                    return value
                except json.JSONDecodeError:
                    continue
    raise ValueError("OpenRouter returned invalid JSON")


def _normalize_article(item, index):
    if not isinstance(item, dict):
        raise ValueError("OpenRouter returned an article in an invalid format")
    title = str(item.get("title") or "").strip()
    html = str(item.get("contentHtml") or item.get("html") or item.get("content") or "").strip()
    if not title or not html:
        raise ValueError("OpenRouter returned an article without a title or contentHtml")
    keywords = item.get("secondaryKeywords") if isinstance(item.get("secondaryKeywords"), list) else []
    tags = item.get("tags") if isinstance(item.get("tags"), list) else [item.get("primaryKeyword"), *keywords]
    base = slugify(str(item.get("slug") or title))[:210] or f"article-{index + 1}"
    return {
        "title": title[:500],
        "slug": f"{base}-{uuid.uuid4().hex[:12]}",
        "excerpt": str(item.get("excerpt") or item.get("metaDescription") or title).strip(),
        "contentHtml": html,
        "status": "published",
        "author": "Andrew Nicklson",
        "tags": [str(tag).strip()[:100] for tag in tags if tag][:10],
        "seoTitle": str(item.get("seoTitle") or title)[:80],
        "seoDescription": str(item.get("seoDescription") or item.get("metaDescription") or "")[:180],
    }


def generate_and_store_articles(count=3):
    row = get_settings_row()
    options = get_settings_data(row)
    key = api_key_for(row)
    if not key:
        raise ValidationError("Add an OpenRouter API key in AI generation settings before generating articles.")

    prompt = options["masterPrompt"][:options["openRouterMaxInputChars"]]
    instruction = (
        'Return JSON only: {"articles":[{"title":"...","slug":"...","seoTitle":"...",'
        '"metaDescription":"...","primaryKeyword":"...","secondaryKeywords":["..."],'
        '"excerpt":"...","tags":["..."],"contentHtml":"..."}]}. '
        f"Generate exactly {count} complete article{'s' if count != 1 else ''}. "
        "contentHtml must be full article HTML without markdown tables, images, or financial guarantees."
    )
    body = {
        "model": options["openRouterModel"],
        "max_tokens": options["openRouterMaxOutputTokens"],
        "temperature": options["openRouterTemperature"],
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": instruction},
            {"role": "user", "content": f"{prompt}\n\nGenerate exactly {count} articles. Reply with valid JSON only."},
        ],
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": options["openRouterSiteUrl"],
        "X-Title": "MakeMoneyOrDie",
    }
    last_error = None
    for attempt in range(options["openRouterRetryAttempts"]):
        try:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=body,
                timeout=options["openRouterTimeoutMs"] / 1000,
            )
            response.raise_for_status()
            payload = response.json()
            parsed = _parse_json(payload["choices"][0]["message"]["content"])
            articles = parsed if isinstance(parsed, list) else parsed.get("articles", [parsed])
            if not isinstance(articles, list) or len(articles) != count:
                raise ValueError(f"OpenRouter returned {len(articles) if isinstance(articles, list) else 0} of {count} articles")
            normalized = [_normalize_article(item, index) for index, item in enumerate(articles)]
            covers = list_covers()
            serializers = []
            for article in normalized:
                if covers:
                    article["coverImage"] = random.choice(covers)["url"]
                serializer = PostSerializer(data=article)
                serializer.is_valid(raise_exception=True)
                serializers.append(serializer)
            return [serializer.save(source=Post.Source.AI) for serializer in serializers]
        except (requests.RequestException, ValueError, KeyError, IndexError, TypeError, json.JSONDecodeError, ValidationError) as error:
            last_error = error
            logger.warning("OpenRouter generation attempt %s/%s failed: %s", attempt + 1, options["openRouterRetryAttempts"], error)
    raise GenerationFailed(str(last_error) if last_error else "OpenRouter generation failed")
