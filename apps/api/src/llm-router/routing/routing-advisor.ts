import {
  ClassificationResult,
  RoutingAdvisorDecision,
  LlmProvider,
  MODEL_REGISTRY,
} from '../llm-router.types';
import { resolveModelCandidates } from './routing-rules';

const ADVISOR_SYSTEM = `You are an AI routing expert. Analyze the user prompt and return JSON only.

Output format:
{
  "modality": "text" | "image" | "video" | "audio",
  "complexity": "low" | "medium" | "high",
  "taskType": "coding" | "analysis" | "creative" | "chat" | "research",
  "requiresWebSearch": boolean,
  "recommendedModelKey": string,
  "reason": string
}

Rules:
- Prefer CHEAPEST model that can achieve high-quality output
- Use research task + Perplexity ONLY if real-time/web data is needed
- Use coding task for Claude/GPT on code-heavy prompts
- Use analysis task for Claude/Gemini on reasoning-heavy prompts
- Use creative task for GPT/Grok on creative content
- NEVER recommend a model not in the provided list`;

type AdvisorCallFn = (prompt: string, systemPrompt: string) => Promise<string>;

/**
 * LLM Router Advisor — uses a cheap model to analyze complex prompts and
 * recommend optimal routing. Only called when heuristic confidence < 0.70.
 */
export class RoutingAdvisor {
  constructor(
    private readonly callFn: AdvisorCallFn,
    private readonly availableProviders: Set<LlmProvider>,
  ) {}

  async advise(
    prompt: string,
    heuristic: ClassificationResult,
  ): Promise<RoutingAdvisorDecision> {
    // Short-circuit: heuristic confidence is high — trust it
    if (heuristic.confidence >= 0.70) {
      return this.fromHeuristic(heuristic);
    }

    // Short-circuit: simple prompts don't need advisor overhead
    if (heuristic.estimatedTokens < 100 && heuristic.complexity === 'low') {
      return this.fromHeuristic(heuristic);
    }

    try {
      const availableKeys = Object.keys(MODEL_REGISTRY)
        .filter((k) => this.availableProviders.has(MODEL_REGISTRY[k].provider));

      const userPrompt =
        `Available model keys: ${availableKeys.join(', ')}\n\nUser prompt:\n${prompt.slice(0, 1500)}`;

      const raw = await this.callFn(userPrompt, ADVISOR_SYSTEM);
      const parsed = this.extractJson(raw);

      if (parsed && this.isValidDecision(parsed, availableKeys)) {
        return {
          ...parsed,
          source: 'llm_advisor',
        } as RoutingAdvisorDecision;
      }
    } catch (_e) {
      // Advisor failed — fall through to heuristic
    }

    return this.fromHeuristic(heuristic);
  }

  private fromHeuristic(h: ClassificationResult): RoutingAdvisorDecision {
    const candidates = resolveModelCandidates(h.modality, h.complexity, h.taskType);
    const available = candidates.find((k) => {
      const spec = MODEL_REGISTRY[k];
      return spec && this.availableProviders.has(spec.provider);
    }) ?? candidates[0] ?? 'gemini-2.0-flash';

    return {
      modality: h.modality,
      complexity: h.complexity,
      taskType: h.taskType,
      requiresWebSearch: h.requiresWebSearch,
      recommendedProvider: MODEL_REGISTRY[available]?.provider ?? 'google',
      recommendedModelKey: available,
      reason: `Heuristic: modality=${h.modality} complexity=${h.complexity} task=${h.taskType}`,
      source: 'heuristic',
    };
  }

  private extractJson(raw: string): Record<string, unknown> | null {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }

  private isValidDecision(obj: Record<string, unknown>, availableKeys: string[]): boolean {
    return (
      typeof obj.modality === 'string' &&
      typeof obj.complexity === 'string' &&
      typeof obj.taskType === 'string' &&
      typeof obj.requiresWebSearch === 'boolean' &&
      typeof obj.recommendedModelKey === 'string' &&
      availableKeys.includes(obj.recommendedModelKey as string)
    );
  }
}
