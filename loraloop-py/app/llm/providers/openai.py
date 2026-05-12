"""OpenAI provider adapter — covers gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini."""

from __future__ import annotations

from openai import AsyncOpenAI, APIError, APIStatusError, RateLimitError

from app.config import settings
from app.llm.models import ModelSpec
from app.llm.providers import ProviderResponse, ProviderError, FatalProviderError


_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.openai_api_key:
            raise FatalProviderError("OPENAI_API_KEY not configured")
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def call(
    model: ModelSpec,
    *,
    messages: list[dict],
    max_tokens: int,
    temperature: float,
    json_mode: bool,
) -> ProviderResponse:
    client = _get_client()
    try:
        resp = await client.chat.completions.create(
            model=model.provider_model_id,
            messages=messages,  # type: ignore[arg-type]
            max_tokens=max_tokens,
            temperature=temperature,
            response_format={"type": "json_object"} if json_mode else {"type": "text"},
        )
    except RateLimitError as e:
        raise ProviderError(f"openai rate-limit: {e}", retryable=True, status=429) from e
    except APIStatusError as e:
        if e.status_code in (401, 403):
            raise FatalProviderError(f"openai auth: {e}", status=e.status_code) from e
        if e.status_code == 400:
            raise FatalProviderError(f"openai bad request: {e}", status=400) from e
        raise ProviderError(f"openai {e.status_code}: {e}", retryable=True, status=e.status_code) from e
    except APIError as e:
        raise ProviderError(f"openai api error: {e}") from e

    choice = resp.choices[0]
    return ProviderResponse(
        content=choice.message.content or "",
        input_tokens=resp.usage.prompt_tokens if resp.usage else 0,
        output_tokens=resp.usage.completion_tokens if resp.usage else 0,
        finish_reason=choice.finish_reason or "stop",
    )
