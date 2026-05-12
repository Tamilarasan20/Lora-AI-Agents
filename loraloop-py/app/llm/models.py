"""Model registry — the single source of truth for which models we support,
their cost tiers, pricing, context windows, and capabilities.

Update one entry here and the router picks it up everywhere.
"""

from dataclasses import dataclass, field
from typing import Literal

CostTier = Literal["cheap", "balanced", "premium"]
Provider = Literal["openai", "anthropic", "google", "openrouter"]
Capability = Literal[
    "text",
    "json",
    "tool_use",
    "vision",
    "long_context",  # >100k context
    "creative",
    "reasoning",
]


@dataclass(frozen=True)
class ModelSpec:
    id: str                              # canonical id used by router
    provider: Provider
    provider_model_id: str               # what we pass to the provider SDK
    cost_tier: CostTier
    cost_input_per_1m: float             # USD per 1M input tokens
    cost_output_per_1m: float            # USD per 1M output tokens
    context_window: int
    max_output_tokens: int
    capabilities: frozenset[Capability]
    rpm_limit: int = 60                  # default requests/minute
    # Higher = preferred within the same cost tier
    quality_score: int = 50


# ─── The registry ────────────────────────────────────────────────────────────
# Pricing as of 2026-05 (USD per 1M tokens). Update quarterly.
MODEL_REGISTRY: dict[str, ModelSpec] = {
    # ── CHEAP tier ──
    "gpt-4o-mini": ModelSpec(
        id="gpt-4o-mini",
        provider="openai",
        provider_model_id="gpt-4o-mini",
        cost_tier="cheap",
        cost_input_per_1m=0.15,
        cost_output_per_1m=0.60,
        context_window=128_000,
        max_output_tokens=16_384,
        capabilities=frozenset({"text", "json", "tool_use", "vision"}),
        rpm_limit=10_000,
        quality_score=70,
    ),
    "gpt-4-1-mini": ModelSpec(
        id="gpt-4-1-mini",
        provider="openai",
        provider_model_id="gpt-4.1-mini",
        cost_tier="cheap",
        cost_input_per_1m=0.40,
        cost_output_per_1m=1.60,
        context_window=1_000_000,
        max_output_tokens=32_768,
        capabilities=frozenset({"text", "json", "tool_use", "vision", "long_context"}),
        rpm_limit=10_000,
        quality_score=78,
    ),
    "claude-haiku-4-5": ModelSpec(
        id="claude-haiku-4-5",
        provider="anthropic",
        provider_model_id="claude-haiku-4-5-20251001",
        cost_tier="cheap",
        cost_input_per_1m=0.25,
        cost_output_per_1m=1.25,
        context_window=200_000,
        max_output_tokens=8192,
        capabilities=frozenset({"text", "json", "tool_use", "long_context"}),
        rpm_limit=5_000,
        quality_score=75,
    ),
    "gemini-flash-lite": ModelSpec(
        id="gemini-flash-lite",
        provider="google",
        provider_model_id="gemini-2.0-flash-lite",
        cost_tier="cheap",
        cost_input_per_1m=0.075,
        cost_output_per_1m=0.30,
        context_window=1_000_000,
        max_output_tokens=8192,
        capabilities=frozenset({"text", "json", "vision", "long_context"}),
        rpm_limit=15_000,
        quality_score=65,
    ),

    # ── BALANCED tier ──
    "gpt-4o": ModelSpec(
        id="gpt-4o",
        provider="openai",
        provider_model_id="gpt-4o",
        cost_tier="balanced",
        cost_input_per_1m=2.50,
        cost_output_per_1m=10.00,
        context_window=128_000,
        max_output_tokens=16_384,
        capabilities=frozenset({"text", "json", "tool_use", "vision", "creative"}),
        rpm_limit=10_000,
        quality_score=88,
    ),
    "claude-sonnet-4-6": ModelSpec(
        id="claude-sonnet-4-6",
        provider="anthropic",
        provider_model_id="claude-sonnet-4-6",
        cost_tier="balanced",
        cost_input_per_1m=3.00,
        cost_output_per_1m=15.00,
        context_window=200_000,
        max_output_tokens=8192,
        capabilities=frozenset(
            {"text", "json", "tool_use", "long_context", "creative", "reasoning"}
        ),
        rpm_limit=4_000,
        quality_score=92,
    ),
    "gemini-flash": ModelSpec(
        id="gemini-flash",
        provider="google",
        provider_model_id="gemini-2.0-flash",
        cost_tier="balanced",
        cost_input_per_1m=0.30,
        cost_output_per_1m=1.20,
        context_window=1_000_000,
        max_output_tokens=8192,
        capabilities=frozenset(
            {"text", "json", "tool_use", "vision", "long_context", "creative"}
        ),
        rpm_limit=10_000,
        quality_score=82,
    ),

    # ── PREMIUM tier ──
    "claude-opus-4-7": ModelSpec(
        id="claude-opus-4-7",
        provider="anthropic",
        provider_model_id="claude-opus-4-7",
        cost_tier="premium",
        cost_input_per_1m=15.00,
        cost_output_per_1m=75.00,
        context_window=200_000,
        max_output_tokens=8192,
        capabilities=frozenset(
            {"text", "json", "tool_use", "long_context", "creative", "reasoning"}
        ),
        rpm_limit=1_000,
        quality_score=100,
    ),
    "gpt-4-1": ModelSpec(
        id="gpt-4-1",
        provider="openai",
        provider_model_id="gpt-4.1",
        cost_tier="premium",
        cost_input_per_1m=2.00,
        cost_output_per_1m=8.00,
        context_window=1_000_000,
        max_output_tokens=32_768,
        capabilities=frozenset(
            {"text", "json", "tool_use", "vision", "long_context", "creative", "reasoning"}
        ),
        rpm_limit=10_000,
        quality_score=95,
    ),
}


def get_model(model_id: str) -> ModelSpec:
    if model_id not in MODEL_REGISTRY:
        raise KeyError(f"Unknown model: {model_id}")
    return MODEL_REGISTRY[model_id]


def models_by_tier(tier: CostTier) -> list[ModelSpec]:
    """Return models in a cost tier, sorted by quality_score descending."""
    matches = [m for m in MODEL_REGISTRY.values() if m.cost_tier == tier]
    return sorted(matches, key=lambda m: m.quality_score, reverse=True)


def models_with_capability(
    capability: Capability,
    *,
    tier: CostTier | None = None,
) -> list[ModelSpec]:
    matches = [m for m in MODEL_REGISTRY.values() if capability in m.capabilities]
    if tier:
        matches = [m for m in matches if m.cost_tier == tier]
    return sorted(matches, key=lambda m: m.quality_score, reverse=True)


# ─── Task-type → preferred model chain ───────────────────────────────────────
# Each task type maps to a fallback chain. The router walks the chain and
# returns the first model that responds successfully within budget.
TASK_PROFILES: dict[str, list[str]] = {
    # Cheap chat / short copy — favour low-cost first
    "chat":          ["gpt-4o-mini", "gemini-flash-lite", "claude-haiku-4-5"],
    "short-copy":    ["gpt-4o-mini", "gemini-flash-lite", "claude-haiku-4-5"],

    # Structured JSON outputs — need reliable JSON support
    "structured":    ["gpt-4o-mini", "gemini-flash", "claude-haiku-4-5", "gpt-4o"],

    # SEO / GEO briefs — moderate complexity, JSON output
    "seo-brief":     ["gpt-4o-mini", "claude-haiku-4-5", "gemini-flash", "gpt-4o"],

    # Strategic / reasoning — premium worth it
    "strategy":      ["claude-sonnet-4-6", "gpt-4o", "claude-opus-4-7"],
    "reasoning":     ["claude-sonnet-4-6", "gpt-4-1", "claude-opus-4-7"],

    # Creative copy / hooks — favour creative-capable models
    "creative":      ["claude-haiku-4-5", "gemini-flash", "claude-sonnet-4-6", "gpt-4o"],

    # Long-context / document analysis
    "long-context":  ["gemini-flash", "gpt-4-1-mini", "claude-sonnet-4-6"],

    # Vision tasks
    "vision":        ["gpt-4o-mini", "gemini-flash", "gpt-4o"],

    # Tool-use loops (agents)
    "tool-use":      ["gpt-4o-mini", "claude-haiku-4-5", "claude-sonnet-4-6", "gpt-4o"],

    # Fact extraction / reconciliation — cheap is fine
    "extraction":    ["gpt-4o-mini", "gemini-flash-lite", "claude-haiku-4-5"],
}


def chain_for(task_type: str) -> list[str]:
    return TASK_PROFILES.get(task_type, TASK_PROFILES["chat"])
