import { Injectable } from '@nestjs/common';
import { BaseAgent, AgentRunResult, ToolDefinition } from '../base-agent';
import { LlmRouterService } from '../../llm-router/llm-router.service';
import { ELENA_SYSTEM_PROMPT } from './elena.prompts';
import { buildElenaTools } from './elena.tools';

export type AdNetwork = 'meta' | 'google' | 'tiktok' | 'linkedin' | 'youtube';
export type CampaignObjective = 'awareness' | 'traffic' | 'leads' | 'sales' | 'app-installs' | 'engagement';

export interface CampaignPlanRequest {
  product: string;
  brandName: string;
  brandVoice?: string;
  network: AdNetwork;
  objective: CampaignObjective;
  budgetUsdPerDay: number;
  durationDays?: number;
  audienceHints?: string;
  currentPerformance?: {
    impressions?: number;
    clicks?: number;
    conversions?: number;
    spendUsd?: number;
    ctr?: number;
    cpa?: number;
    roas?: number;
  };
}

export interface CreativeVariantRequest {
  product: string;
  brandName: string;
  network: AdNetwork;
  count?: number;
  hookTypes?: Array<'pain-point' | 'curiosity' | 'social-proof' | 'urgency' | 'aspiration' | 'transformation'>;
}

export interface OptimisationRequest {
  campaignName: string;
  network: AdNetwork;
  currentPerformance: {
    ctrPercent: number;
    cpaUsd?: number;
    roasMultiple?: number;
    spendUsd: number;
    conversions?: number;
    sustainedDays?: number;
  };
  targets: { cpaUsd?: number; roas?: number };
}

@Injectable()
export class ElenaAgent extends BaseAgent {
  protected readonly agentName = 'Elena';
  protected readonly systemPrompt = ELENA_SYSTEM_PROMPT;
  protected readonly tools: ToolDefinition[] = buildElenaTools();

  constructor(router: LlmRouterService) {
    super();
    this.router = router;
  }

  /**
   * Build a launch-ready campaign plan: audiences, creatives, budget split,
   * KPI targets, optimisation rules, forecast.
   */
  async buildCampaign(req: CampaignPlanRequest): Promise<AgentRunResult> {
    const totalBudget = req.budgetUsdPerDay * (req.durationDays ?? 14);
    const perfBlock = req.currentPerformance
      ? `Current performance (optimise based on this):\n${Object.entries(req.currentPerformance).map(([k, v]) => `  - ${k}: ${v}`).join('\n')}`
      : 'No prior campaign data — new launch.';

    const prompt = `Build a complete paid campaign plan.

Product/offer: ${req.product}
Brand: ${req.brandName}
${req.brandVoice ? `Brand voice: ${req.brandVoice}` : ''}
Network: ${req.network}
Objective: ${req.objective}
Daily budget: $${req.budgetUsdPerDay}
Duration: ${req.durationDays ?? 14} days (total $${totalBudget})
${req.audienceHints ? `Audience hints: ${req.audienceHints}` : ''}

${perfBlock}

Return STRICT JSON:
{
  "campaignName": "...",
  "objective": "${req.objective}",
  "network": "${req.network}",
  "totalBudgetUsd": ${totalBudget},
  "dailyBudgetUsd": ${req.budgetUsdPerDay},
  "durationDays": ${req.durationDays ?? 14},
  "biddingStrategy": "...",
  "audiences": [
    {
      "name": "...",
      "type": "cold | warm | retargeting | lookalike",
      "interests": ["..."],
      "demographics": { "ageRange": "...", "gender": "...", "locations": ["..."] },
      "behaviours": ["..."],
      "estimatedReachLow": 0,
      "estimatedReachHigh": 0
    }
  ],
  "creatives": [
    {
      "variantName": "...",
      "headline": "<=40 chars",
      "primaryText": "<=125 chars",
      "description": "<=30 chars",
      "callToAction": "Shop Now | Learn More | Sign Up | Get Quote | Download",
      "visualConcept": "...",
      "hookType": "pain-point | curiosity | social-proof | urgency | aspiration | transformation"
    }
  ],
  "budgetSplit": [{ "audienceName": "...", "creativeName": "...", "sharePercent": 0 }],
  "utmTemplate": "...",
  "conversionEvents": ["..."],
  "kpiTargets": { "ctr": "...", "cpc": "...", "cpa": "...", "roas": "..." },
  "optimisationRules": {
    "kill": ["..."],
    "scale": ["..."],
    "iterate": ["..."]
  },
  "testingPlan": ["..."],
  "forecastedMetrics": { "impressions": "...", "clicks": "...", "conversions": "...", "estimatedSpend": "..." }
}`;

    return this.run(prompt, { request: req }, {
      taskType: 'elena-build-campaign',
      temperature: 0.6,
      maxTokens: 6144,
    });
  }

  /**
   * Generate creative variants for split-testing. Each variant changes one
   * variable (hook type) so tests stay clean.
   */
  async generateCreatives(req: CreativeVariantRequest): Promise<AgentRunResult> {
    const prompt = `Generate ${req.count ?? 5} ad creative variants for split-testing.

Product: ${req.product}
Brand: ${req.brandName}
Network: ${req.network}
${req.hookTypes?.length ? `Hook types to cover: ${req.hookTypes.join(', ')}` : ''}

Each variant must change ONE variable (the hook type) so the test is clean.

Return STRICT JSON: { "variants": [{ "variantName": "...", "headline": "...", "primaryText": "...", "description": "...", "callToAction": "...", "visualConcept": "...", "hookType": "..." }] }`;

    return this.run(prompt, { request: req }, {
      taskType: 'elena-generate-creatives',
      temperature: 0.8,
      maxTokens: 2048,
    });
  }

  /**
   * Given current performance, recommend the next optimisation move.
   * Uses the evaluate_optimisation_rules tool to ground decisions in
   * deterministic kill/scale/iterate logic before adding LLM context.
   */
  async optimise(req: OptimisationRequest): Promise<AgentRunResult> {
    const prompt = `Recommend the next optimisation move for this campaign.

Campaign: ${req.campaignName}
Network: ${req.network}
Current performance: ${JSON.stringify(req.currentPerformance, null, 2)}
Targets: ${JSON.stringify(req.targets, null, 2)}

Use evaluate_optimisation_rules to ground your decision. Then explain WHY in business terms.

Return STRICT JSON:
{
  "decision": "kill | scale | iterate | hold",
  "specificAction": "Exact action to take",
  "reasoning": "Business context for the decision",
  "expectedImpact": "What metric will move and by how much",
  "fallbackPlan": "What to do if the action doesn't work"
}`;

    return this.run(prompt, { request: req }, {
      taskType: 'elena-optimise',
      temperature: 0.4,
      maxTokens: 2048,
    });
  }
}
