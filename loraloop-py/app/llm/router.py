"""The smart router.

Walks the model chain for a given task type / cost tier, retries on
transient errors with exponential backoff, falls through to the next
model on persistent failure, and returns the first successful response
with full cost telemetry.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Literal

import structlog
from pydantic import BaseModel, Field

from app.config import settings
from app.llm import cost as cost_utils
from app.llm.models import ModelSpec, chain_for, get_model, models_by_tier
from app.llm.providers import (
    FatalProviderError,
    ProviderError,
    ProviderResponse,
)
from app.llm.providers import anthropic as anthropic_provider
from app.llm.providers import google as google_provider
from app.llm.providers import openai as openai_provider
from app.llm.providers import openrouter as openrouter_provider

logger = structlog.get_logger(__name__)


# ─── Request / response shapes ───────────────────────────────────────────────
class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class RouteRequest(BaseModel):
    """Inbound request to the router."""

    task_type: str = Field(
        default="chat",
        description=(
            "Logical task category — chat, short-copy, structured, seo-brief, "
            "strategy, reasoning, creative, long-context, vision, tool-use, "
            "extraction. Determines the model fallback chain."
        ),
    )
    messages: list[Message]
    cost_tier: Literal["cheap", "balanced", "premium"] | None = None
    max_tokens: int = 1024
    temperature: float = 0.7
    json_mode: bool = False
    # Optional explicit model override (skips routing entirely)
    force_model: str | None = None
    # Hard ceiling — if the chain exceeds this, fail
    max_cost_usd: float | None = None
    # Maximum retries per model on transient errors
    max_retries_per_model: int = 2


class RouteResponse(BaseModel):
    content: str
    model: str
    provider: str
    cost_tier: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    latency_ms: int
    attempts: int
    fallback_path: list[str]


# ─── Backoff schedule for transient errors ───────────────────────────────────
_BACKOFF_SECONDS = [2, 5, 12]


# ─── Provider dispatch ───────────────────────────────────────────────────────
async def _call_provider(
    model: ModelSpec,
    *,
    messages: list[dict],
    max_tokens: int,
    temperature: float,
    json_mode: bool,
) -> ProviderResponse:
    kwargs = {
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "json_mode": json_mode,
    }
    if model.provider == "openai":
        return await openai_provider.call(model, **kwargs)
    if model.provider == "anthropic":
        return await anthropic_provider.call(model, **kwargs)
    if model.provider == "google":
        return await google_provider.call(model, **kwargs)
    if model.provider == "openrouter":
        return await openrouter_provider.call(model, **kwargs)
    raise FatalProviderError(f"Unknown provider: {model.provider}")


# ─── Chain construction ──────────────────────────────────────────────────────
def _build_chain(req: RouteRequest) -> list[ModelSpec]:
    if req.force_model:
        return [get_model(req.force_model)]

    # Task-type default chain
    chain_ids = chain_for(req.task_type)

    # If cost_tier is pinned, filter to that tier (preserving order)
    if req.cost_tier:
        chain_ids = [
            mid for mid in chain_ids if get_model(mid).cost_tier == req.cost_tier
        ]
        # If filtering left us empty, fall back to all models in that tier sorted by quality
        if not chain_ids:
            chain_ids = [m.id for m in models_by_tier(req.cost_tier)]

    return [get_model(mid) for mid in chain_ids]


# ─── Public entry point ──────────────────────────────────────────────────────
async def route_completion(req: RouteRequest) -> RouteResponse:
    """Run the request through the smart router and return the first
    successful response, plus telemetry."""

    chain = _build_chain(req)
    if not chain:
        raise FatalProviderError(
            f"No models available for task={req.task_type} tier={req.cost_tier}"
        )

    started = time.monotonic()
    plain_messages = [m.model_dump() for m in req.messages]
    attempts = 0
    fallback_path: list[str] = []
    last_error: Exception | None = None

    for model in chain:
        fallback_path.append(model.id)

        # Budget guard — refuse to even try if the floor cost exceeds the cap
        if req.max_cost_usd is not None:
            floor = cost_utils.estimate_cost_usd(model, 1000, req.max_tokens)
            if floor > req.max_cost_usd:
                logger.info(
                    "router.skip.budget",
                    model=model.id,
                    floor_usd=floor,
                    max_usd=req.max_cost_usd,
                )
                continue

        for retry in range(req.max_retries_per_model + 1):
            attempts += 1
            try:
                resp = await _call_provider(
                    model,
                    messages=plain_messages,
                    max_tokens=req.max_tokens,
                    temperature=req.temperature,
                    json_mode=req.json_mode,
                )
            except FatalProviderError as e:
                logger.warning(
                    "router.fatal_provider_error",
                    model=model.id,
                    provider=model.provider,
                    err=str(e),
                )
                last_error = e
                break  # move to next model in chain
            except ProviderError as e:
                last_error = e
                if not e.retryable or retry >= req.max_retries_per_model:
                    logger.warning(
                        "router.give_up_on_model",
                        model=model.id,
                        provider=model.provider,
                        retries=retry,
                        err=str(e),
                    )
                    break
                delay = _BACKOFF_SECONDS[min(retry, len(_BACKOFF_SECONDS) - 1)]
                logger.info(
                    "router.retry",
                    model=model.id,
                    provider=model.provider,
                    retry=retry + 1,
                    delay_s=delay,
                    err=str(e),
                )
                await asyncio.sleep(delay)
                continue
            else:
                cost = cost_utils.estimate_cost_usd(
                    model, resp.input_tokens, resp.output_tokens
                )
                latency_ms = int((time.monotonic() - started) * 1000)
                if settings.enable_router_telemetry:
                    logger.info(
                        "router.success",
                        task=req.task_type,
                        model=model.id,
                        provider=model.provider,
                        input_tokens=resp.input_tokens,
                        output_tokens=resp.output_tokens,
                        cost_usd=cost,
                        latency_ms=latency_ms,
                        attempts=attempts,
                        fallback_depth=len(fallback_path),
                    )
                return RouteResponse(
                    content=resp.content,
                    model=model.id,
                    provider=model.provider,
                    cost_tier=model.cost_tier,
                    input_tokens=resp.input_tokens,
                    output_tokens=resp.output_tokens,
                    cost_usd=round(cost, 6),
                    latency_ms=latency_ms,
                    attempts=attempts,
                    fallback_path=fallback_path,
                )

    # Exhausted the chain
    raise FatalProviderError(
        f"All models failed for task={req.task_type}. Last error: {last_error}"
    )
