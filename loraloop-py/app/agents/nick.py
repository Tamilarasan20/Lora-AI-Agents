"""NICK — AI Analyst (Python port).

Reads performance data from posts, ads, video, email, blog. Reports what
worked, what didn't, why, and what to do next. Returns ranked insights +
a prioritised action list.
"""

from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.llm import RouteRequest, route_completion
from app.llm.router import Message


NICK_SYSTEM_PROMPT = """You are NICK, head of growth analytics for Loraloop.

You read the team's performance data and tell them — bluntly and specifically — what worked, what didn't, and what to do next.

Analysis standards:
- Every insight must cite specific item IDs and metric values — no hand-waving
- Use the right metric per format: organic = engagement rate + reach, ads = ROAS + CPA, video = completion + watch time, email = CTR + conversion
- Distinguish correlation from cause: when in doubt, label findings as hypotheses
- Never recommend "post more" or "engage more" — every action must be executable this week and tied to a KPI

Always produce strict JSON output. No prose, no markdown fences.
"""


ContentSource = Literal["organic-post", "ad", "video", "email", "blog"]


class NickMetrics(BaseModel):
    impressions: int | None = None
    reach: int | None = None
    clicks: int | None = None
    likes: int | None = None
    comments: int | None = None
    shares: int | None = None
    saves: int | None = None
    watch_time_sec: int | None = None
    completion_rate: float | None = None
    ctr: float | None = None
    cpc: float | None = None
    cpa: float | None = None
    roas: float | None = None
    conversions: int | None = None
    revenue_usd: float | None = None
    spend_usd: float | None = None


class NickMeta(BaseModel):
    hook: str | None = None
    format: str | None = None
    hashtags: list[str] = Field(default_factory=list)
    cta: str | None = None


class NickContentItem(BaseModel):
    id: str
    source: ContentSource
    platform: str
    title: str | None = None
    published_at: str | None = None
    metrics: NickMetrics = Field(default_factory=NickMetrics)
    meta: NickMeta | None = None


class NickAnalyseRequest(BaseModel):
    business_name: str
    brand_voice: str | None = None
    items: list[NickContentItem]
    goal: str | None = None
    period_label: str = "Last 30 days"
    memory_context: str | None = None


def _compact_items(items: list[NickContentItem]) -> str:
    lines: list[str] = []
    for it in items[:50]:
        m = it.metrics
        eng = (m.likes or 0) + (m.comments or 0) + (m.shares or 0) + (m.saves or 0)
        er = f"{(eng / m.impressions * 100):.2f}" if m.impressions else "n/a"
        hook = (it.meta.hook[:80] if it.meta and it.meta.hook else "")
        fmt = it.meta.format if it.meta and it.meta.format else "n/a"
        title = (it.title or "")[:60]
        lines.append(
            f"{it.id} | {it.source} | {it.platform} | {title} | "
            f"imp:{m.impressions or 0} eng:{eng} er:{er}% "
            f"ctr:{m.ctr if m.ctr is not None else 'n/a'} "
            f"conv:{m.conversions or 0} roas:{m.roas if m.roas is not None else 'n/a'} "
            f'hook:"{hook}" format:{fmt}'
        )
    return "\n".join(lines)


def _empty_report(req: NickAnalyseRequest) -> dict[str, Any]:
    return {
        "period": req.period_label,
        "summary": "No content data available for this period.",
        "scorecard": {
            "totalContent": 0,
            "avgEngagementRate": "0%",
            "topPerformingFormat": "n/a",
            "topPerformingPlatform": "n/a",
            "overallVerdict": "underperforming",
        },
        "winners": [],
        "losers": [],
        "insights": [],
        "patterns": {"workingPatterns": [], "failingPatterns": []},
        "nextActions": [
            {
                "priority": "do-now",
                "action": "Publish content to generate performance data",
                "expectedImpact": "Establishes baseline metrics for analysis",
            }
        ],
        "benchmarkNotes": [],
    }


async def run(req: NickAnalyseRequest) -> dict[str, Any]:
    if not req.items:
        return {
            "agent": "nick",
            "report": _empty_report(req),
            "router": None,
        }

    memory_block = f"\n{req.memory_context}\n" if req.memory_context else ""

    user_prompt = f"""Analyse the following content performance data.
{memory_block}
Business: {req.business_name}
{f'Brand voice: {req.brand_voice}' if req.brand_voice else ''}
Period: {req.period_label}
{f'Stated goal: {req.goal}' if req.goal else ''}

Content performance ({len(req.items)} items):
{_compact_items(req.items)}

Return STRICT JSON:
{{
  "period": "{req.period_label}",
  "summary": "2-3 sentence executive summary",
  "scorecard": {{
    "totalContent": {len(req.items)},
    "avgEngagementRate": "X.X%",
    "topPerformingFormat": "...",
    "topPerformingPlatform": "...",
    "overallVerdict": "crushing-it | on-track | underperforming | mixed"
  }},
  "winners": [
    {{"itemId": "...", "reason": "...", "metric": "...", "value": "...", "replicableElements": ["..."]}}
  ],
  "losers": [
    {{"itemId": "...", "reason": "...", "metric": "...", "value": "...", "fixSuggestion": "..."}}
  ],
  "insights": [
    {{
      "rank": 1,
      "severity": "high | medium | low",
      "category": "hook | format | timing | audience | creative | cta | targeting | budget | platform",
      "finding": "...",
      "evidence": ["..."],
      "recommendation": "..."
    }}
  ],
  "patterns": {{
    "workingPatterns": ["..."],
    "failingPatterns": ["..."]
  }},
  "nextActions": [
    {{"priority": "do-now | do-this-week | do-this-month", "action": "...", "expectedImpact": "..."}}
  ],
  "benchmarkNotes": ["..."]
}}
"""

    response = await route_completion(
        RouteRequest(
            task_type="extraction",
            cost_tier="cheap",
            messages=[
                Message(role="system", content=NICK_SYSTEM_PROMPT),
                Message(role="user", content=user_prompt),
            ],
            max_tokens=4096,
            temperature=0.4,
            json_mode=True,
        )
    )

    try:
        report = json.loads(response.content)
    except json.JSONDecodeError:
        report = {"raw": response.content, "parse_error": True}

    return {
        "agent": "nick",
        "report": report,
        "router": {
            "model": response.model,
            "provider": response.provider,
            "cost_tier": response.cost_tier,
            "cost_usd": response.cost_usd,
            "latency_ms": response.latency_ms,
            "fallback_path": response.fallback_path,
        },
    }
