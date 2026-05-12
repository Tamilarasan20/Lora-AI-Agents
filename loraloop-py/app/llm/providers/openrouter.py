"""OpenRouter provider — proxies any model through one OpenAI-compatible API.

Useful as a fallback when our direct provider keys are exhausted, or to
access models we don't have a direct integration for yet.
"""

from __future__ import annotations

import httpx

from app.config import settings
from app.llm.models import ModelSpec
from app.llm.providers import ProviderResponse, ProviderError, FatalProviderError


_BASE_URL = "https://openrouter.ai/api/v1"


async def call(
    model: ModelSpec,
    *,
    messages: list[dict],
    max_tokens: int,
    temperature: float,
    json_mode: bool,
) -> ProviderResponse:
    if not settings.openrouter_api_key:
        raise FatalProviderError("OPENROUTER_API_KEY not configured")

    payload: dict = {
        "model": model.provider_model_id,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "HTTP-Referer": "https://loraloop.ai",
        "X-Title": "Loraloop",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(
                f"{_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            )
        except httpx.RequestError as e:
            raise ProviderError(f"openrouter network: {e}") from e

    if resp.status_code in (401, 403):
        raise FatalProviderError(f"openrouter auth: {resp.text}", status=resp.status_code)
    if resp.status_code == 400:
        raise FatalProviderError(f"openrouter bad request: {resp.text}", status=400)
    if resp.status_code >= 500 or resp.status_code == 429:
        raise ProviderError(f"openrouter {resp.status_code}", retryable=True, status=resp.status_code)
    if resp.status_code >= 400:
        raise ProviderError(f"openrouter {resp.status_code}: {resp.text}", retryable=False, status=resp.status_code)

    data = resp.json()
    choice = data["choices"][0]
    usage = data.get("usage", {})
    return ProviderResponse(
        content=choice["message"]["content"] or "",
        input_tokens=usage.get("prompt_tokens", 0),
        output_tokens=usage.get("completion_tokens", 0),
        finish_reason=choice.get("finish_reason", "stop"),
    )
