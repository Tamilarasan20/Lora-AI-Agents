"""Smart LLM router — pick the cheapest model that can handle the task,
fall back through tiers on rate-limit / failure, track cost per call.

Public surface:

    from app.llm import route_completion, RouteRequest

    response = await route_completion(RouteRequest(
        task_type="copy",
        messages=[{"role": "user", "content": "Write a hook"}],
        cost_tier="cheap",
        max_tokens=512,
    ))
"""

from app.llm.router import route_completion, RouteRequest, RouteResponse
from app.llm.models import MODEL_REGISTRY, get_model
from app.llm.cost import estimate_cost_usd

__all__ = [
    "route_completion",
    "RouteRequest",
    "RouteResponse",
    "MODEL_REGISTRY",
    "get_model",
    "estimate_cost_usd",
]
