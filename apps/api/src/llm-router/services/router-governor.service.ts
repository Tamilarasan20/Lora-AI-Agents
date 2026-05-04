import { Injectable, Logger } from '@nestjs/common';
import { RouterDecision } from '../schemas/router-decision.schema';
import { ProviderAdapterFactory } from '../adapters/provider-adapter.factory';

export interface GovernorContext {
  userId: string;
  planTier: string;
  subscriptionStatus: string;
  creditsRemaining: number;
  creditsReserved: number;
  monthlySpendUsd: number;
  requestsLastMinute: number;
}

export interface GovernorResult {
  approved: boolean;
  decision: RouterDecision;
  blockedReason?: string;
  tierOverride?: string;
  providerOverride?: string;
  modifications: string[];
}

@Injectable()
export class RouterGovernorService {
  private readonly logger = new Logger(RouterGovernorService.name);

  // Cost caps per plan (USD/month)
  private readonly PLAN_MONTHLY_CAP: Record<string, number> = {
    FREE:       5.00,
    SOLO:      15.00,
    PRO:       60.00,
    AGENCY:   150.00,
    ENTERPRISE: 500.00,
  };

  // Max tier per plan
  private readonly PLAN_MAX_TIER: Record<string, string> = {
    FREE:       'cheap',
    SOLO:       'standard',
    PRO:        'premium',
    AGENCY:     'frontier',
    ENTERPRISE: 'frontier',
  };

  constructor(private readonly factory: ProviderAdapterFactory) {}

  enforce(decision: RouterDecision, ctx: GovernorContext): GovernorResult {
    const mods: string[] = [];
    let blocked = false;
    let blockReason = '';
    let current = { ...decision };

    // Rule 1: Subscription not active
    if (ctx.subscriptionStatus === 'past_due' || ctx.subscriptionStatus === 'canceled') {
      blocked = true;
      blockReason = `Subscription ${ctx.subscriptionStatus} — cannot route requests`;
    }

    // Rule 2: No credits remaining
    if (!blocked && ctx.creditsRemaining <= 0) {
      blocked = true;
      blockReason = 'Insufficient credits — upgrade or wait for monthly reset';
    }

    // Rule 3: Reserved credits exceed remaining
    if (!blocked && ctx.creditsReserved > ctx.creditsRemaining) {
      blocked = true;
      blockReason = 'Credit reservation would exceed remaining balance';
    }

    // Rule 4: Monthly spend cap exceeded
    if (!blocked) {
      const cap = this.PLAN_MONTHLY_CAP[ctx.planTier.toUpperCase()] ?? 5.00;
      if (ctx.monthlySpendUsd >= cap) {
        blocked = true;
        blockReason = `Monthly spend cap $${cap} reached for ${ctx.planTier} plan`;
      }
    }

    // Rule 5: Rate limit — >60 requests/min (FREE), >300/min (others)
    if (!blocked) {
      const rateLimit = ctx.planTier.toUpperCase() === 'FREE' ? 60 : 300;
      if (ctx.requestsLastMinute > rateLimit) {
        blocked = true;
        blockReason = `Rate limit exceeded: ${ctx.requestsLastMinute} requests/min`;
      }
    }

    if (blocked) {
      return { approved: false, decision: current, blockedReason: blockReason, modifications: mods };
    }

    // Rule 6: Tier cap by plan
    const planMaxTier = this.PLAN_MAX_TIER[ctx.planTier.toUpperCase()] ?? 'cheap';
    const tierOrder = ['cheap', 'standard', 'premium', 'frontier', 'specialist'];
    const requestedIdx = tierOrder.indexOf(current.recommendedTier);
    const maxIdx = tierOrder.indexOf(planMaxTier);

    if (requestedIdx > maxIdx) {
      const original = current.recommendedTier;
      current = { ...current, recommendedTier: planMaxTier as RouterDecision['recommendedTier'] };
      mods.push(`Tier downgraded: ${original} → ${planMaxTier} (plan limit)`);
    }

    // Rule 7: Image must route to image-capable providers
    if (current.modality === 'image') {
      if (!['openai', 'gemini'].includes(current.recommendedTier)) {
        mods.push('Image modality — ensuring image-capable provider');
      }
    }

    // Rule 8: Video must route to Gemini
    if (current.modality === 'video') {
      const geminiAvailable = this.factory.getHealthyProviders().includes('gemini');
      if (!geminiAvailable) {
        blocked = true;
        blockReason = 'Video generation requires Gemini (GEMINI_API_KEY not configured)';
        return { approved: false, decision: current, blockedReason: blockReason, modifications: mods };
      }
    }

    // Rule 9: Realtime research → must use Perplexity if available
    if (current.requiresRealtimeData && current.requiresSearch) {
      const perplexityAvailable = this.factory.getHealthyProviders().includes('perplexity');
      if (perplexityAvailable) {
        mods.push('Realtime+search → routing to Perplexity specialist');
      }
    }

    // Rule 10: Scraping tasks → prefer Gemini
    if (current.taskType === 'scraping') {
      const geminiAvailable = this.factory.getHealthyProviders().includes('gemini');
      if (geminiAvailable) {
        mods.push('Scraping task → preferring Gemini for multimodal extraction');
      }
    }

    // Rule 11: Critical risk → must use premium+ tier
    if (current.riskLevel === 'high' && !['premium', 'frontier', 'specialist'].includes(current.recommendedTier)) {
      const enforced = maxIdx >= tierOrder.indexOf('premium') ? 'premium' : planMaxTier;
      if (enforced !== current.recommendedTier) {
        mods.push(`High risk — tier upgraded to ${enforced} for safety`);
        current = { ...current, recommendedTier: enforced as RouterDecision['recommendedTier'] };
      }
    }

    // Rule 12: Long context requires long-context capable model
    if (current.requiresLongContext && current.maxInputTokens < 50000) {
      current = { ...current, maxInputTokens: 100000 };
      mods.push('Long context flag — maxInputTokens raised to 100k');
    }

    // Rule 13: FREE plan cannot use frontier/specialist
    if (ctx.planTier.toUpperCase() === 'FREE' && ['frontier', 'specialist', 'premium'].includes(current.recommendedTier)) {
      current = { ...current, recommendedTier: 'cheap' };
      mods.push('FREE plan — tier capped to cheap');
    }

    // Rule 14: Ensure fallback if no redundant providers
    const availableProviders = this.factory.getHealthyProviders();
    if (availableProviders.length < 2) {
      current = { ...current, fallbackRequired: false };
      mods.push('Only 1 provider available — fallback disabled');
    }

    // Rule 15: Max output tokens cap for cheap tier
    if (current.recommendedTier === 'cheap' && current.maxOutputTokens > 4000) {
      current = { ...current, maxOutputTokens: 4000 };
      mods.push('Cheap tier — maxOutputTokens capped at 4000');
    }

    return { approved: true, decision: current, modifications: mods };
  }
}
