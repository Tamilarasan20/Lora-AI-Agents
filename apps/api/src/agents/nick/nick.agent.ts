import { Injectable } from '@nestjs/common';
import { BaseAgent, AgentRunResult, ToolDefinition } from '../base-agent';
import { LlmRouterService } from '../../llm-router/llm-router.service';
import { NICK_SYSTEM_PROMPT } from './nick.prompts';
import { buildNickTools } from './nick.tools';

export type ContentSource = 'organic-post' | 'ad' | 'video' | 'email' | 'blog';

export interface NickContentItem {
  id: string;
  source: ContentSource;
  platform: string;
  title?: string;
  publishedAt?: string;
  metrics: {
    impressions?: number;
    reach?: number;
    clicks?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    watchTimeSec?: number;
    completionRate?: number;
    ctr?: number;
    cpc?: number;
    cpa?: number;
    roas?: number;
    conversions?: number;
    revenueUsd?: number;
    spendUsd?: number;
  };
  meta?: {
    hook?: string;
    format?: string;
    hashtags?: string[];
    cta?: string;
  };
}

export interface AnalyseRequest {
  businessName: string;
  brandVoice?: string;
  items: NickContentItem[];
  goal?: string;
  periodLabel?: string;
}

function compactItems(items: NickContentItem[]): string {
  return items
    .slice(0, 50)
    .map((it) => {
      const m = it.metrics;
      const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
      const er = m.impressions ? ((eng / m.impressions) * 100).toFixed(2) : 'n/a';
      return `${it.id} | ${it.source} | ${it.platform} | ${it.title?.slice(0, 60) ?? ''} | imp:${m.impressions ?? 0} eng:${eng} er:${er}% ctr:${m.ctr ?? 'n/a'} conv:${m.conversions ?? 0} roas:${m.roas ?? 'n/a'} hook:"${it.meta?.hook?.slice(0, 80) ?? ''}" format:${it.meta?.format ?? 'n/a'}`;
    })
    .join('\n');
}

@Injectable()
export class NickAgent extends BaseAgent {
  protected readonly agentName = 'Nick';
  protected readonly systemPrompt = NICK_SYSTEM_PROMPT;
  protected readonly tools: ToolDefinition[] = buildNickTools();

  constructor(router: LlmRouterService) {
    super();
    this.router = router;
  }

  /**
   * Analyse a period of content performance — returns winners, losers,
   * ranked insights, working/failing patterns, and a prioritised action list.
   */
  async analyse(req: AnalyseRequest): Promise<AgentRunResult> {
    const periodLabel = req.periodLabel ?? 'Last 30 days';

    const prompt = `Analyse the following content performance data and produce a ranked, evidence-backed report.

Business: ${req.businessName}
${req.brandVoice ? `Brand voice: ${req.brandVoice}` : ''}
Period: ${periodLabel}
${req.goal ? `Stated goal: ${req.goal}` : ''}

Content performance (${req.items.length} items):
${compactItems(req.items)}

Rules:
- Cite specific item IDs and metric values for every claim
- Use the right metric per format (organic = ER + reach, ads = ROAS + CPA, video = completion + watch time, email = CTR + conv)
- No generic recommendations ("post more" / "engage more") — every action must be executable this week
- Distinguish correlation from causation; label hypotheses as such

Return STRICT JSON:
{
  "period": "${periodLabel}",
  "summary": "2-3 sentence executive summary of the period",
  "scorecard": {
    "totalContent": ${req.items.length},
    "avgEngagementRate": "X.X%",
    "topPerformingFormat": "Format type",
    "topPerformingPlatform": "Platform name",
    "overallVerdict": "crushing-it | on-track | underperforming | mixed"
  },
  "winners": [
    {
      "itemId": "id from data",
      "reason": "Why it won — specific to this piece",
      "metric": "Which KPI it dominated",
      "value": "The actual number",
      "replicableElements": ["What to copy into future content"]
    }
  ],
  "losers": [
    {
      "itemId": "id from data",
      "reason": "Why it failed — specific diagnosis",
      "metric": "Which KPI tanked",
      "value": "The actual number",
      "fixSuggestion": "Concrete fix for next time"
    }
  ],
  "insights": [
    {
      "rank": 1,
      "severity": "high | medium | low",
      "category": "hook | format | timing | audience | creative | cta | targeting | budget | platform",
      "finding": "What you discovered in plain English",
      "evidence": ["Specific item IDs and metrics that support this"],
      "recommendation": "What to do about it"
    }
  ],
  "patterns": {
    "workingPatterns": ["Pattern across multiple winners"],
    "failingPatterns": ["Pattern across multiple losers"]
  },
  "nextActions": [
    {
      "priority": "do-now | do-this-week | do-this-month",
      "action": "Specific, executable action",
      "expectedImpact": "What lift you expect and on which KPI"
    }
  ],
  "benchmarkNotes": ["How this compares to industry baselines"]
}`;

    return this.run(prompt, { period: periodLabel, item_count: req.items.length }, {
      taskType: 'nick-analyse-performance',
      temperature: 0.4,
      maxTokens: 4096,
    });
  }
}
