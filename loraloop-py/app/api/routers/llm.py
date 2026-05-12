"""LLM router HTTP surface.

POST /llm/complete             → route a chat completion through the smart router
GET  /llm/models               → list all registered models with pricing
GET  /llm/cost-explain         → quick cost calculator helper
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.llm import RouteRequest, RouteResponse, route_completion
from app.llm.cost import explain_cost
from app.llm.models import MODEL_REGISTRY, get_model
from app.llm.providers import FatalProviderError, ProviderError

router = APIRouter()


@router.post("/complete", response_model=RouteResponse)
async def complete(req: RouteRequest) -> RouteResponse:
    try:
        return await route_completion(req)
    except FatalProviderError as e:
        raise HTTPException(status_code=502, detail=f"All providers failed: {e}") from e
    except ProviderError as e:
        raise HTTPException(status_code=503, detail=f"Routing error: {e}") from e


@router.get("/models")
async def list_models() -> dict:
    return {
        "count": len(MODEL_REGISTRY),
        "models": [
            {
                "id": m.id,
                "provider": m.provider,
                "tier": m.cost_tier,
                "context_window": m.context_window,
                "max_output_tokens": m.max_output_tokens,
                "cost_input_per_1m_usd": m.cost_input_per_1m,
                "cost_output_per_1m_usd": m.cost_output_per_1m,
                "capabilities": sorted(m.capabilities),
                "quality_score": m.quality_score,
            }
            for m in MODEL_REGISTRY.values()
        ],
    }


@router.get("/cost-explain")
async def cost_explain(model: str, input_tokens: int, output_tokens: int) -> dict:
    try:
        get_model(model)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return explain_cost(model, input_tokens, output_tokens)
