# Nick — AI Analyst

> **Role**: Head of growth analytics
> **Codebase**: `apps/api/src/agents/nick/` (NestJS) · `loraloop-py/app/agents/nick.py` (Python)
> **Endpoint**: `POST /agents/nick`
> **Task type**: `extraction` · cost tier `cheap` (Sonnet-grade reasoning not required)

## Job

Read mixed-source performance data — organic posts, paid ads, video, email, blog — and produce a ranked, evidence-backed report telling the team what worked, what didn't, and what to do next.

## Inputs

```ts
interface AnalyseRequest {
  businessName: string;
  brandVoice?: string;
  items: NickContentItem[];
  goal?: string;
  periodLabel?: string;   // default: "Last 30 days"
}

interface NickContentItem {
  id: string;
  source: 'organic-post' | 'ad' | 'video' | 'email' | 'blog';
  platform: string;            // tiktok, instagram, linkedin, meta-ads, ga4, ...
  title?: string;
  publishedAt?: string;
  metrics: {
    impressions?, reach?, clicks?, likes?, comments?, shares?, saves?,
    watchTimeSec?, completionRate?, ctr?, cpc?, cpa?, roas?,
    conversions?, revenueUsd?, spendUsd?
  };
  meta?: { hook?, format?, hashtags?, cta? };
}
```

## Output

Strict JSON. Key sections:

- **`scorecard`** — totals + overall verdict (`crushing-it | on-track | underperforming | mixed`)
- **`winners[]`** — top performers with `replicableElements[]` you can copy into future content
- **`losers[]`** — underperformers with `fixSuggestion`
- **`insights[]`** — ranked, severity-tagged, evidence-cited findings across categories: hook, format, timing, audience, creative, cta, targeting, budget, platform
- **`patterns`** — recurring `workingPatterns[]` and `failingPatterns[]`
- **`nextActions[]`** — prioritised (`do-now | do-this-week | do-this-month`) with expected impact tied to a KPI
- **`benchmarkNotes[]`** — comparisons against industry baselines where data permits

## Standards (enforced via system prompt)

1. **Every insight cites specific item IDs and metric values** — no hand-waving
2. **Use the right metric per format**: organic → engagement rate + reach; ads → ROAS + CPA; video → completion rate + watch time; email → CTR + conversion
3. **Correlation ≠ causation** — when in doubt, label findings as hypotheses and recommend a test
4. **No generic recommendations** — "post more" / "engage more" are non-actions
5. **Refuse to analyse** when the dataset has < 3 items, all items are < 48h old, or every item is missing impressions

## Tools Nick has

| Tool                       | Purpose                                                              |
|----------------------------|----------------------------------------------------------------------|
| `compute_engagement_rate`  | `(likes + comments + shares + saves) / impressions` — saves bad math |
| `rank_by_metric`           | Sort items by a numeric field, return top N — finds winners/losers   |
| `classify_verdict`         | Aggregate scorecard → verdict label against a goal                   |

Phase 2 adds Meta Ads, Google Ads, GA4, and platform analytics API tools behind the same interface.

## Memory wiring

Like the other agents, Nick accepts a `memory_context: str` and stores reflection-layer facts about what consistently wins or fails for this brand. After analysis, fact extraction runs fire-and-forget to update the memory layer (`reflection` scope, agent `nick + shared`).

## Example

```bash
curl -X POST http://localhost:8000/agents/nick -H 'Content-Type: application/json' -d '{
  "business_name": "Acme Inc",
  "period_label": "Last 14 days",
  "goal": "Hit 3% engagement on LinkedIn",
  "items": [
    {
      "id": "p_001",
      "source": "organic-post",
      "platform": "linkedin",
      "title": "5 lessons from shipping our first agent",
      "metrics": { "impressions": 12400, "likes": 287, "comments": 41, "shares": 19 },
      "meta": { "hook": "I deleted 60% of our roadmap last week. Here is why.", "format": "story" }
    }
  ]
}'
```
