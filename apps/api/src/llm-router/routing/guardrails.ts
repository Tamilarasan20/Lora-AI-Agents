import {
  RoutingAdvisorDecision,
  CreditContext,
  UserPlanTier,
  LlmProvider,
  MODEL_REGISTRY,
  ModelSpec,
} from '../llm-router.types';
import { resolveModelCandidates } from './routing-rules';

// Cost per request hard limits by plan (USD)
const PLAN_MAX_COST_USD: Record<UserPlanTier, number> = {
  free:       0.01,
  starter:    0.10,
  pro:        1.00,
  enterprise: 10.00,
};

// Tier ordering (higher index = better tier)
const PLAN_ORDER: UserPlanTier[] = ['free', 'starter', 'pro', 'enterprise'];

export function applyGuardrails(
  decision: RoutingAdvisorDecision,
  creditCtx: CreditContext | undefined,
  availableProviders: Set<LlmProvider>,
): RoutingAdvisorDecision {
  const planTier = creditCtx?.planTier ?? 'free';

  let modelKey = decision.recommendedModelKey;
  let spec = MODEL_REGISTRY[modelKey];

  // 1. Check provider availability
  if (!spec || !availableProviders.has(spec.provider)) {
    modelKey = findFallbackModel(decision, planTier, availableProviders) ?? modelKey;
    spec = MODEL_REGISTRY[modelKey];
  }

  // 2. Check plan tier restriction
  if (spec && !isPlanAllowed(spec, planTier)) {
    modelKey = downgradeModel(decision, planTier, availableProviders) ?? modelKey;
    spec = MODEL_REGISTRY[modelKey];
  }

  // 3. Check credit availability
  if (creditCtx && creditCtx.creditsRemainingCents <= 0) {
    // Force cheapest free-tier model
    modelKey = cheapestFreeModel(availableProviders) ?? modelKey;
    spec = MODEL_REGISTRY[modelKey];
  }

  // 4. Check per-request cost cap
  const maxCost = PLAN_MAX_COST_USD[planTier];
  const estimatedCost = spec ? estimateRequestCost(spec) : 0;
  if (estimatedCost > maxCost) {
    const cheaper = findCheaperModel(decision, maxCost, planTier, availableProviders);
    if (cheaper) modelKey = cheaper;
    spec = MODEL_REGISTRY[modelKey];
  }

  if (!spec) {
    throw new Error(`Guardrails: no suitable model found for plan=${planTier}`);
  }

  return {
    ...decision,
    recommendedModelKey: modelKey,
    recommendedProvider: spec.provider,
    reason: decision.reason + ` [guardrails: plan=${planTier}]`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPlanAllowed(spec: ModelSpec, planTier: UserPlanTier): boolean {
  return PLAN_ORDER.indexOf(planTier) >= PLAN_ORDER.indexOf(spec.minPlanTier);
}

function findFallbackModel(
  decision: RoutingAdvisorDecision,
  planTier: UserPlanTier,
  available: Set<LlmProvider>,
): string | undefined {
  const candidates = resolveModelCandidates(
    decision.modality,
    decision.complexity,
    decision.taskType,
  );
  return candidates.find((k) => {
    const s = MODEL_REGISTRY[k];
    return s && available.has(s.provider) && isPlanAllowed(s, planTier);
  });
}

function downgradeModel(
  decision: RoutingAdvisorDecision,
  planTier: UserPlanTier,
  available: Set<LlmProvider>,
): string | undefined {
  // Try same modality at lower complexity first
  const tiers = ['low', 'medium', 'high'] as const;
  const currentIdx = tiers.indexOf(decision.complexity);

  for (let i = currentIdx; i >= 0; i--) {
    const candidates = resolveModelCandidates(decision.modality, tiers[i], decision.taskType);
    const found = candidates.find((k) => {
      const s = MODEL_REGISTRY[k];
      return s && available.has(s.provider) && isPlanAllowed(s, planTier);
    });
    if (found) return found;
  }
  return undefined;
}

function cheapestFreeModel(available: Set<LlmProvider>): string | undefined {
  return Object.entries(MODEL_REGISTRY)
    .filter(([, s]) => s.modality === 'text' && s.minPlanTier === 'free' && available.has(s.provider))
    .sort(([, a], [, b]) => (a.inputCostPer1M + a.outputCostPer1M) - (b.inputCostPer1M + b.outputCostPer1M))
    .at(0)?.[0];
}

function findCheaperModel(
  decision: RoutingAdvisorDecision,
  maxCostUsd: number,
  planTier: UserPlanTier,
  available: Set<LlmProvider>,
): string | undefined {
  return Object.entries(MODEL_REGISTRY)
    .filter(([, s]) =>
      s.modality === decision.modality &&
      available.has(s.provider) &&
      isPlanAllowed(s, planTier) &&
      estimateRequestCost(s) <= maxCostUsd,
    )
    .sort(([, a], [, b]) => estimateRequestCost(a) - estimateRequestCost(b))
    .at(0)?.[0];
}

function estimateRequestCost(spec: ModelSpec): number {
  // Estimate for ~1000 input + 500 output tokens
  return (1000 / 1_000_000) * spec.inputCostPer1M +
         (500  / 1_000_000) * spec.outputCostPer1M;
}
