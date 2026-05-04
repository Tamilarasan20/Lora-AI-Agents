import { z } from 'zod';

export const RouterDecisionSchema = z.object({
  modality:                z.enum(['text', 'image', 'video', 'audio', 'embedding', 'vision']),
  taskType:                z.enum([
    'chat', 'strategy', 'research', 'copywriting', 'image_prompt',
    'image_generation', 'video_generation', 'analytics', 'scraping',
    'classification', 'summarization', 'planning', 'review',
  ]),
  agentName:               z.enum(['Lora', 'Sam', 'Clara', 'Steve', 'Sarah']).optional(),
  complexity:              z.enum(['low', 'medium', 'high', 'critical']),
  requiresRealtimeData:    z.boolean(),
  requiresLongContext:     z.boolean(),
  requiresStructuredOutput: z.boolean(),
  requiresVision:          z.boolean(),
  requiresSearch:          z.boolean(),
  riskLevel:               z.enum(['low', 'medium', 'high']),
  latencyPriority:         z.enum(['low', 'normal', 'fast']),
  costPriority:            z.enum(['cheap', 'balanced', 'quality']),
  recommendedTier:         z.enum(['router', 'cheap', 'standard', 'premium', 'frontier', 'specialist']),
  maxInputTokens:          z.number().int().positive(),
  maxOutputTokens:         z.number().int().positive(),
  reasoningDepth:          z.enum(['none', 'low', 'medium', 'high']),
  fallbackRequired:        z.boolean(),
  explanation:             z.string().max(500),
});

export type RouterDecision = z.infer<typeof RouterDecisionSchema>;

// Deterministic fallback when advisor fails
export const DEFAULT_ROUTER_DECISION: RouterDecision = {
  modality:                 'text',
  taskType:                 'chat',
  complexity:               'medium',
  requiresRealtimeData:     false,
  requiresLongContext:      false,
  requiresStructuredOutput: false,
  requiresVision:           false,
  requiresSearch:           false,
  riskLevel:                'low',
  latencyPriority:          'normal',
  costPriority:             'balanced',
  recommendedTier:          'standard',
  maxInputTokens:           8000,
  maxOutputTokens:          2000,
  reasoningDepth:           'low',
  fallbackRequired:         true,
  explanation:              'Deterministic fallback — advisor failed.',
};
