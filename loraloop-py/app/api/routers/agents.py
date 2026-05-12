"""Agent HTTP routes.

Each agent gets a single POST endpoint. The agent module owns its
input/output shape; the route is a thin pass-through.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.agents.sophie import SophieBriefRequest, run as run_sophie
from app.llm.providers import FatalProviderError, ProviderError

router = APIRouter()


@router.post("/sophie")
async def sophie(req: SophieBriefRequest) -> dict:
    try:
        return await run_sophie(req)
    except FatalProviderError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except ProviderError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


# Stubs — pending port from loraloop-mvp/ts in subsequent PRs
# @router.post("/lora") ...
# @router.post("/clara") ...
# @router.post("/steve") ...
# @router.post("/theo") ...
# @router.post("/elena") ...
# @router.post("/nick") ...
# @router.post("/sarah") ...
# @router.post("/sam") ...
