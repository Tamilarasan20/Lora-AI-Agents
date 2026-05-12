"""Google provider adapter — Gemini Flash / Flash Lite / Pro."""

from __future__ import annotations

from google import genai

from app.config import settings
from app.llm.models import ModelSpec
from app.llm.providers import ProviderResponse, ProviderError, FatalProviderError


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.gemini_api_key:
            raise FatalProviderError("GEMINI_API_KEY not configured")
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _to_gemini_contents(messages: list[dict]) -> tuple[str | None, list[dict]]:
    """Gemini takes `system_instruction` separately and uses parts[] for content."""
    system_msg: str | None = None
    contents: list[dict] = []
    for m in messages:
        role = m.get("role")
        if role == "system":
            system_msg = m.get("content", "")
        elif role in ("user", "assistant"):
            gemini_role = "user" if role == "user" else "model"
            contents.append({"role": gemini_role, "parts": [{"text": m.get("content", "")}]})
    return system_msg, contents


async def call(
    model: ModelSpec,
    *,
    messages: list[dict],
    max_tokens: int,
    temperature: float,
    json_mode: bool,
) -> ProviderResponse:
    client = _get_client()
    system_msg, contents = _to_gemini_contents(messages)

    config: dict = {
        "max_output_tokens": min(max_tokens, model.max_output_tokens),
        "temperature": temperature,
    }
    if json_mode:
        config["response_mime_type"] = "application/json"
    if system_msg:
        config["system_instruction"] = system_msg

    try:
        resp = await client.aio.models.generate_content(
            model=model.provider_model_id,
            contents=contents,
            config=config,
        )
    except Exception as e:  # google-genai raises broad google.api_core exceptions
        msg = str(e)
        if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
            raise ProviderError(f"gemini rate-limit: {msg}", retryable=True, status=429) from e
        if "401" in msg or "PERMISSION_DENIED" in msg or "API_KEY_INVALID" in msg:
            raise FatalProviderError(f"gemini auth: {msg}", status=401) from e
        if "400" in msg:
            raise FatalProviderError(f"gemini bad request: {msg}", status=400) from e
        raise ProviderError(f"gemini error: {msg}") from e

    text = resp.text or ""
    usage = resp.usage_metadata
    return ProviderResponse(
        content=text,
        input_tokens=usage.prompt_token_count if usage else 0,
        output_tokens=usage.candidates_token_count if usage else 0,
        finish_reason="stop",
    )
