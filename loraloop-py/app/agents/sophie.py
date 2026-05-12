"""SOPHIE — SEO + GEO Manager (Python port).

Proof of concept that the smart router + an agent compose cleanly.
The other 8 agents follow the same shape: build prompt → route → parse.
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, Field

from app.llm import RouteRequest, route_completion
from app.llm.router import Message


SOPHIE_SYSTEM_PROMPT = """You are SOPHIE, an elite SEO + GEO (Generative Engine Optimisation) strategist for Loraloop.

You make content rank — on classic search (Google) AND on generative engines (ChatGPT, Claude, Perplexity).

Always produce strict JSON output. Never add commentary, never wrap in markdown fences.

Key principles:
- Primary keyword + 3-5 secondary keywords for every brief
- Meta title <= 60 chars, meta description <= 155 chars
- 3+ citable facts per long-form piece
- Direct-answer blocks 2-3 sentences after each question heading
- JSON-LD schema markup with the right @type
"""


class SophieBriefRequest(BaseModel):
    topic: str
    brand_name: str
    brand_voice: str | None = None
    platform: str = Field(default="blog")
    target_keywords: list[str] = Field(default_factory=list)
    audience: str | None = None
    existing_content: str | None = None
    memory_context: str | None = None


async def run(req: SophieBriefRequest) -> dict[str, Any]:
    memory_block = f"\n{req.memory_context}\n" if req.memory_context else ""

    user_prompt = f"""Build a complete SEO + GEO brief.
{memory_block}
Topic: {req.topic}
Brand: {req.brand_name}
{f'Brand voice: {req.brand_voice}' if req.brand_voice else ''}
Platform: {req.platform}
{f'Audience: {req.audience}' if req.audience else ''}
{f'Seed keywords: {", ".join(req.target_keywords)}' if req.target_keywords else ''}
{f'Existing draft:\n{req.existing_content[:2000]}' if req.existing_content else ''}

Return STRICT JSON:
{{
  "primaryKeyword": "...",
  "secondaryKeywords": ["..."],
  "longTailKeywords": ["..."],
  "searchIntent": "informational | navigational | transactional | commercial",
  "metaTitle": "<= 60 chars",
  "metaDescription": "<= 155 chars",
  "slug": "kebab-case-url",
  "h1": "...",
  "outline": [{{"heading": "...", "level": "h2", "bullets": ["..."]}}],
  "faqs": [{{"question": "...", "answer": "..."}}],
  "schemaMarkup": {{"type": "Article", "jsonLd": {{}}}},
  "geoOptimisations": {{
    "citableFacts": ["..."],
    "directAnswers": [{{"question": "...", "answer": "..."}}],
    "sourceCredibilityHooks": ["..."],
    "structuredFormat": "..."
  }},
  "internalLinkSuggestions": ["..."],
  "contentScore": 0
}}
"""

    response = await route_completion(
        RouteRequest(
            task_type="seo-brief",
            cost_tier="cheap",
            messages=[
                Message(role="system", content=SOPHIE_SYSTEM_PROMPT),
                Message(role="user", content=user_prompt),
            ],
            max_tokens=4096,
            temperature=0.6,
            json_mode=True,
        )
    )

    try:
        brief = json.loads(response.content)
    except json.JSONDecodeError:
        brief = {"raw": response.content, "parse_error": True}

    return {
        "agent": "sophie",
        "brief": brief,
        "router": {
            "model": response.model,
            "provider": response.provider,
            "cost_tier": response.cost_tier,
            "cost_usd": response.cost_usd,
            "latency_ms": response.latency_ms,
            "fallback_path": response.fallback_path,
        },
    }
