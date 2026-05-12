"""Token cost accounting."""

from app.llm.models import ModelSpec, get_model


def estimate_cost_usd(
    model: str | ModelSpec,
    input_tokens: int,
    output_tokens: int,
) -> float:
    """Return the USD cost of a completion given token counts."""
    spec = get_model(model) if isinstance(model, str) else model
    return (
        (input_tokens / 1_000_000) * spec.cost_input_per_1m
        + (output_tokens / 1_000_000) * spec.cost_output_per_1m
    )


def explain_cost(
    model: str | ModelSpec,
    input_tokens: int,
    output_tokens: int,
) -> dict[str, float | str]:
    """Return a structured cost breakdown — useful for telemetry and bills."""
    spec = get_model(model) if isinstance(model, str) else model
    input_cost = (input_tokens / 1_000_000) * spec.cost_input_per_1m
    output_cost = (output_tokens / 1_000_000) * spec.cost_output_per_1m
    return {
        "model": spec.id,
        "tier": spec.cost_tier,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "input_cost_usd": round(input_cost, 6),
        "output_cost_usd": round(output_cost, 6),
        "total_cost_usd": round(input_cost + output_cost, 6),
    }
