# Loraloop: TypeScript → Python Migration Plan

This document tracks the port of all AI agents from the Next.js app
(`loraloop-app/src/lib/agents/`) to the FastAPI backend (`loraloop-py/app/agents/`).

---

## Status

| Agent  | Role                   | TS file           | Python file           | Status     |
|--------|------------------------|-------------------|-----------------------|------------|
| Sophie | SEO + GEO Manager      | `sophie.ts`       | `agents/sophie.py`    | ✅ Done    |
| Lora   | Brand Strategist       | `lora.ts`         | `agents/lora.py`      | ⏳ Pending |
| Clara  | Content Writer         | `clara.ts`        | `agents/clara.py`     | ⏳ Pending |
| Steve  | Social Media Manager   | `steve.ts`        | `agents/steve.py`     | ⏳ Pending |
| Theo   | Video Producer         | `theo.ts`         | `agents/theo.py`      | ⏳ Pending |
| Elena  | Ads Manager            | `elena.ts`        | `agents/elena.py`     | ⏳ Pending |
| Nick   | Performance Analyst    | `nick.ts`         | `agents/nick.py`      | ⏳ Pending |
| Sarah  | Email Marketer         | `sarah.ts`        | `agents/sarah.py`     | ⏳ Pending |
| Sam    | Scheduler              | `sam.ts`          | `agents/sam.py`       | ⏳ Pending |

---

## Pattern for each port

Every agent follows the same shape. Porting a new agent takes ~30 min.

### 1. Create `loraloop-py/app/agents/{name}.py`

```python
from __future__ import annotations
import json
from typing import Any
from pydantic import BaseModel, Field
from app.llm import RouteRequest, route_completion
from app.llm.router import Message

SYSTEM_PROMPT = """..."""  # copy from TS, convert JSX template to Python f-string

class {Name}Request(BaseModel):
    # mirror the TS Input interface — snake_case fields
    ...

async def run(req: {Name}Request) -> dict[str, Any]:
    user_prompt = f"""..."""  # f-string version of the TS prompt template

    response = await route_completion(
        RouteRequest(
            task_type="...",    # see TASK_PROFILES in llm/models.py
            cost_tier="cheap",  # or "balanced" / "premium"
            messages=[
                Message(role="system", content=SYSTEM_PROMPT),
                Message(role="user", content=user_prompt),
            ],
            max_tokens=4096,
            temperature=0.7,
            json_mode=True,
        )
    )

    try:
        result = json.loads(response.content)
    except json.JSONDecodeError:
        result = {"raw": response.content, "parse_error": True}

    return {
        "agent": "{name}",
        "result": result,
        "router": {
            "model": response.model,
            "provider": response.provider,
            "cost_usd": response.cost_usd,
            "latency_ms": response.latency_ms,
            "fallback_path": response.fallback_path,
        },
    }
```

### 2. Register in `loraloop-py/app/agents/__init__.py`

```python
from app.agents.{name} import run as run_{name}
__all__ = [..., "run_{name}"]
```

### 3. Add route in `loraloop-py/app/api/routers/agents.py`

```python
from app.agents.{name} import {Name}Request, run as run_{name}

@router.post("/{name}")
async def {name}(req: {Name}Request) -> dict:
    try:
        return await run_{name}(req)
    except FatalProviderError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except ProviderError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
```

---

## Task-type mapping

| Agent  | `task_type`    | `cost_tier` | Notes                          |
|--------|----------------|-------------|--------------------------------|
| Sophie | `seo-brief`    | `cheap`     | JSON mode, ~1500 tok output    |
| Lora   | `strategy`     | `balanced`  | High-quality strategic output  |
| Clara  | `creative`     | `cheap`     | Long-form, can be batched      |
| Steve  | `creative`     | `cheap`     | Short posts, high volume       |
| Theo   | `creative`     | `balanced`  | Structured shot list           |
| Elena  | `strategy`     | `balanced`  | Campaign planning              |
| Nick   | `extraction`   | `cheap`     | Data analysis, structured out  |
| Sarah  | `creative`     | `cheap`     | Email copy                     |
| Sam    | `extraction`   | `cheap`     | Calendar parsing               |

---

## Memory wiring

After porting each agent, wire memory context retrieval following the same
pattern used in the TypeScript agents:

1. Accept optional `memory_context: str | None` in the request model
2. In the route handler, fetch memory from Supabase via the `memories_hybrid_search`
   RPC before calling `run()`
3. After `run()`, fire-and-forget a background task to extract + reconcile new facts

The Python memory SDK is not yet ported — this will be `loraloop-py/app/memory/`
mirroring `loraloop-app/src/lib/memory/`.

---

## What stays in TypeScript (Next.js)

- Supabase Auth (magic link OTP) — keep in Next.js API routes
- Stripe webhook handler — keep in Next.js API routes  
- Knowledge-base / funnel creation — keep untouched
- Public-facing marketing pages (Next.js SSR)

The FastAPI backend handles only LLM routing and agent execution.
The Next.js app calls the FastAPI backend for agent runs.

---

## Deployment order

1. Deploy FastAPI to Hetzner via `infra/docker-compose.yml`
2. Update Next.js agent API routes to proxy to `LORALOOP_API_URL`
3. Port agents one at a time, verifying via Sophie UI at `app.loraloop.ai/agents/sophie`
4. Once all 9 agents are live, deprecate the Gemini-direct calls in Next.js
