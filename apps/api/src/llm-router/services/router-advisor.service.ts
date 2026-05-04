import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ROUTER_ADVISOR_SYSTEM_PROMPT,
  buildAdvisorUserPrompt,
} from '../prompts/router-advisor.prompt';
import {
  RouterDecisionSchema,
  RouterDecision,
  DEFAULT_ROUTER_DECISION,
} from '../schemas/router-decision.schema';
import { ProviderAdapterFactory } from '../adapters/provider-adapter.factory';

const ADVISOR_PROVIDER_PRIORITY: Array<[string, string]> = [
  ['gemini',    'gemini-2.0-flash'],
  ['openai',    'gpt-4o-mini'],
  ['anthropic', 'claude-haiku-4-5-20251001'],
  ['xai',       'grok-3-mini'],
  ['meta',      'meta-llama/llama-4-maverick-17b-128e-instruct'],
];

const MAX_RETRIES = 2;

@Injectable()
export class RouterAdvisorService {
  private readonly logger = new Logger(RouterAdvisorService.name);

  constructor(
    private readonly factory: ProviderAdapterFactory,
    private readonly config: ConfigService,
  ) {}

  async analyze(taskContext: {
    agentName?: string;
    prompt: string;
    availableTiers: string[];
  }): Promise<{ decision: RouterDecision; source: 'llm' | 'fallback' }> {
    const userPrompt = buildAdvisorUserPrompt(taskContext);

    for (const [provider, modelId] of ADVISOR_PROVIDER_PRIORITY) {
      const adapter = this.factory.get(provider, modelId);
      if (!adapter) continue;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await adapter.generateText({
            systemPrompt: ROUTER_ADVISOR_SYSTEM_PROMPT,
            userPrompt: attempt === 0 ? userPrompt : this.buildRepairPrompt(userPrompt, ''),
            temperature: 0,
            maxTokens: 600,
            timeoutMs: 15_000,
          });

          const raw = response.text ?? '';
          const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = RouterDecisionSchema.safeParse(JSON.parse(jsonStr));

          if (parsed.success) {
            this.logger.debug(`Advisor used ${provider}/${modelId} (attempt ${attempt + 1})`);
            return { decision: parsed.data, source: 'llm' };
          }

          this.logger.warn(`Advisor validation failed (attempt ${attempt + 1}): ${parsed.error.message}`);
        } catch (err: any) {
          this.logger.warn(`Advisor ${provider} attempt ${attempt + 1} failed: ${err.message}`);
          break; // provider failed — try next provider
        }
      }
    }

    this.logger.warn('Advisor failed all providers — using deterministic fallback');
    return { decision: DEFAULT_ROUTER_DECISION, source: 'fallback' };
  }

  private buildRepairPrompt(originalPrompt: string, badJson: string): string {
    return `${originalPrompt}

IMPORTANT: Your previous response was invalid JSON or did not match the schema.
Return ONLY valid JSON matching the exact schema above. No markdown, no explanation.`;
  }
}
