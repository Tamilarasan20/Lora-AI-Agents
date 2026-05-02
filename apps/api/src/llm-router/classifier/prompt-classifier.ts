import { ModalityType, TaskCategory, ComplexityTier, ClassificationResult } from '../llm-router.types';
import { estimateTokens, getTokenTier } from './token-counter';
import {
  detectModality,
  detectTaskCategory,
  detectWebSearch,
  detectComplexitySignals,
  detectStructuralComplexity,
} from './heuristics';

/**
 * Classifies a prompt in < 2ms using pure heuristics.
 * No API calls, no ML models.
 */
export function classifyPrompt(prompt: string, systemPrompt?: string): ClassificationResult {
  const fullText = systemPrompt ? `${systemPrompt}\n${prompt}` : prompt;
  const tokens = estimateTokens(fullText);
  const tokenTier = getTokenTier(tokens);

  const modality = detectModality(prompt);
  const taskType = detectTaskCategory(prompt);
  const requiresWebSearch = detectWebSearch(prompt) || taskType === 'research';
  const { highSignals, lowSignals } = detectComplexitySignals(prompt);
  const structuralScore = detectStructuralComplexity(prompt);

  const complexity = resolveComplexity(
    taskType, modality, tokenTier, highSignals, lowSignals, structuralScore,
  );

  const confidence = computeConfidence(
    highSignals, lowSignals, structuralScore, tokenTier, requiresWebSearch,
  );

  return {
    modality,
    taskType,
    complexity,
    requiresWebSearch,
    estimatedTokens: tokens,
    confidence,
    signals: { highSignals, lowSignals, structuralScore, tokenTier },
  };
}

// ─── Complexity resolution ────────────────────────────────────────────────────

function resolveComplexity(
  task: TaskCategory,
  modality: ModalityType,
  tokenTier: ReturnType<typeof getTokenTier>,
  highSignals: number,
  lowSignals: number,
  structuralScore: number,
): ComplexityTier {
  // Non-text modalities: complexity drives quality tier only
  if (modality === 'video' || modality === 'audio') return 'medium';

  // Huge context → always high
  if (tokenTier === 'huge') return 'high';

  // Explicit high-complexity signals dominate
  if (highSignals >= 2) return 'high';
  if (highSignals >= 1 && structuralScore >= 3) return 'high';

  // Explicit low signals
  if (lowSignals >= 2 && highSignals === 0 && structuralScore === 0 && tokenTier === 'short') {
    return 'low';
  }

  // Task baseline
  const taskBaseline: Record<TaskCategory, ComplexityTier> = {
    chat:     'low',
    creative: 'medium',
    coding:   'medium',
    analysis: 'high',
    research: 'medium',
  };

  const baseline = taskBaseline[task];

  if (structuralScore >= 4 && baseline === 'low')    return 'medium';
  if (structuralScore >= 4 && baseline === 'medium') return 'high';
  if (tokenTier === 'long' && baseline === 'low')    return 'medium';
  if (tokenTier === 'long' && baseline === 'medium') return 'high';

  return baseline;
}

function computeConfidence(
  highSignals: number,
  lowSignals: number,
  structuralScore: number,
  tokenTier: string,
  requiresWebSearch: boolean,
): number {
  const totalSignals = highSignals + lowSignals + (structuralScore > 0 ? 1 : 0) + (requiresWebSearch ? 1 : 0);
  if (totalSignals >= 4) return 0.95;
  if (totalSignals >= 2) return 0.80;
  if (totalSignals >= 1) return 0.65;
  return 0.50;
}
