import { ModalityType, ComplexityTier, TaskCategory } from '../llm-router.types';

/**
 * Routing matrix — maps (modality × complexity × task) to an ordered model key list.
 * First key = primary; rest = fallbacks.
 *
 * PROVIDER RULES:
 *  - research tasks → ALWAYS Perplexity first
 *  - coding tasks   → prefer Anthropic / OpenAI
 *  - creative tasks → prefer OpenAI / xAI
 *  - analysis tasks → prefer Anthropic / Gemini
 *  - image          → Gemini Imagen (cheap) or DALL-E 3 (quality)
 *  - video          → Veo 3 (Google) only
 *  - audio          → Whisper (transcribe) or OpenAI TTS
 */

export const ROUTING_MATRIX: Record<string, string[]> = {

  // ── TEXT : LOW ─────────────────────────────────────────────────────────────

  'text:low': [
    'gemini-2.0-flash',
    'gpt-4o-mini',
    'grok-3-mini',
    'llama-4-maverick',
  ],
  'text:low:chat': [
    'gemini-2.0-flash',
    'gpt-4o-mini',
    'grok-3-mini',
    'llama-4-maverick',
  ],
  'text:low:coding': [
    'gpt-4o-mini',
    'claude-haiku-4-5',
    'gemini-2.0-flash',
    'llama-3.3-70b',
  ],
  'text:low:creative': [
    'gpt-4o-mini',
    'grok-3-mini',
    'gemini-2.0-flash',
    'llama-4-maverick',
  ],
  'text:low:analysis': [
    'gemini-2.0-flash',
    'claude-haiku-4-5',
    'gpt-4o-mini',
  ],
  // Research at low complexity still needs web — use cheapest Perplexity
  'text:low:research': [
    'perplexity-sonar',
    'grok-3-mini',
    'gemini-2.0-flash',
  ],

  // ── TEXT : MEDIUM ──────────────────────────────────────────────────────────

  'text:medium': [
    'claude-sonnet-4-6',
    'gpt-4.1',
    'gemini-2.5-pro',
    'grok-3',
  ],
  'text:medium:chat': [
    'claude-sonnet-4-6',
    'gpt-4o',
    'gemini-2.5-pro',
    'grok-3',
  ],
  'text:medium:coding': [
    'claude-sonnet-4-6',
    'gpt-4.1',
    'gpt-4o',
    'gemini-2.5-pro',
  ],
  'text:medium:analysis': [
    'claude-sonnet-4-6',
    'gemini-2.5-pro',
    'gpt-4o',
    'grok-3',
  ],
  'text:medium:creative': [
    'gpt-4o',
    'grok-3',
    'claude-sonnet-4-6',
    'gemini-2.5-pro',
  ],
  'text:medium:research': [
    'perplexity-sonar',
    'perplexity-sonar-reasoning',
    'grok-3',
    'gemini-2.5-pro',
  ],

  // ── TEXT : HIGH ────────────────────────────────────────────────────────────

  'text:high': [
    'claude-opus-4-7',
    'gpt-4.1',
    'gemini-2.5-pro',
    'grok-3',
  ],
  'text:high:chat': [
    'claude-opus-4-7',
    'gpt-4o',
    'gemini-2.5-pro',
  ],
  'text:high:coding': [
    'claude-opus-4-7',
    'gpt-4.1',
    'o3-mini',
    'gemini-2.5-pro',
  ],
  'text:high:analysis': [
    'claude-opus-4-7',
    'gemini-2.5-pro',
    'gpt-4.1',
    'grok-3',
  ],
  'text:high:creative': [
    'gpt-4.1',
    'grok-3',
    'claude-opus-4-7',
    'gemini-2.5-pro',
  ],
  // High complexity research = deep web + reasoning
  'text:high:research': [
    'perplexity-sonar-pro',
    'perplexity-sonar-reasoning',
    'claude-opus-4-7',
    'gemini-2.5-pro',
  ],

  // ── IMAGE ──────────────────────────────────────────────────────────────────

  // Low quality / bulk → Imagen (cheaper)
  'image:low': [
    'gemini-imagen',
    'dall-e-2',
  ],
  // Medium — either works
  'image:medium': [
    'dall-e-3',
    'gemini-imagen',
  ],
  // High quality / branding → DALL-E 3 first
  'image:high': [
    'dall-e-3',
    'gemini-imagen',
  ],

  // ── VIDEO ──────────────────────────────────────────────────────────────────

  // Veo 3 is the only production-grade video model in scope
  'video:low':    ['veo-3'],
  'video:medium': ['veo-3'],
  'video:high':   ['veo-3'],

  // ── AUDIO ──────────────────────────────────────────────────────────────────

  'audio:low':    ['whisper-1'],
  'audio:medium': ['whisper-1', 'openai-tts'],
  'audio:high':   ['openai-tts', 'whisper-1'],
};

/**
 * Resolve the ordered model list for a given modality + complexity + optional task.
 * Tries specific key first, then falls back to modality:complexity generic.
 */
export function resolveModelCandidates(
  modality: ModalityType,
  complexity: ComplexityTier,
  taskCategory: TaskCategory,
): string[] {
  const specificKey = `${modality}:${complexity}:${taskCategory}`;
  const genericKey  = `${modality}:${complexity}`;
  return ROUTING_MATRIX[specificKey] ?? ROUTING_MATRIX[genericKey] ?? [];
}
