"""Anthropic provider adapter — Claude Haiku / Sonnet / Opus."""

from __future__ import annotations

from anthropic import AsyncAnthropic, APIError, APIStatusError, RateLimitError

from app.config import settings
from app.llm.models import ModelSpec
from app.llm.providers import ProviderResponse, ProviderError, FatalProviderError


_client: AsyncAnthropic | None = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        if not settings.anthropic_api_key:
            raise FatalProviderError("ANTHROPIC_API_KEY not configured")
        _client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


def _split_system(messages: list[dict]) -> tuple[str | None, list[dict]]:
    """Anthropic takes `system` as a top-level param, not in messages."""
    system_msg: str | None = None
    rest: list[dict] = []
    for m in messages:
        if m.get("role") == "system":
            system_msg = m.get("content", "")
        else:
            rest.append(m)
    return system_msg, rest


async def call(
    model: ModelSpec,
    *,
    messages: list[dict],
    max_tokens: int,
    temperature: float,
    json_mode: bool,
) -> ProviderResponse:
    client = _get_client()
    system_msg, rest = _split_system(messages)

    # Anthropic doesn't have a native JSON mode; we coax via system prompt suffix.
    if json_mode:
        json_directive = "\n\nReturn STRICT JSON. No prose, no markdown fences."
        system_msg = (system_msg or "") + json_directive

    try:
        resp = await client.messages.create(
            model=model.provider_model_id,
            messages=rest,  # type: ignore[arg-type]
            system=system_msg or "",
            max_tokens=min(max_tokens, model.max_output_tokens),
            temperature=temperature,
        )
    except RateLimitError as e:
        raise ProviderError(f"anthropic rate-limit: {e}", retryable=True, status=429) from e
    except APIStatusError as e:
        if e.status_code in (401, 403):
            raise FatalProviderError(f"anthropic auth: {e}", status=e.status_code) from e
        if e.status_code == 400:
            raise FatalProviderError(f"anthropic bad request: {e}", status=400) from e
        raise ProviderError(f"anthropic {e.status_code}: {e}", retryable=True, status=e.status_code) from e
    except APIError as e:
        raise ProviderError(f"anthropic api error: {e}") from e

    text_blocks = [b.text for b in resp.content if getattr(b, "type", "") == "text"]
    return ProviderResponse(
        content="".join(text_blocks),
        input_tokens=resp.usage.input_tokens,
        output_tokens=resp.usage.output_tokens,
        finish_reason=resp.stop_reason or "end_turn",
    )
