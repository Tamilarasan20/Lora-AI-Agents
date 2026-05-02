/**
 * Ultra-fast token estimation without any API call.
 * Uses the ~4 chars/token heuristic that holds well for English prose.
 * Within ±15% of tiktoken for typical prompts — good enough for routing decisions.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Count words * 1.3 (accounts for punctuation/special tokens) as primary signal,
  // but floor to charLen/4 to handle dense technical/code text.
  const byWords = text.split(/\s+/).filter(Boolean).length * 1.3;
  const byChars = text.length / 4;
  return Math.round(Math.max(byWords, byChars));
}

export const TOKEN_THRESHOLDS = {
  SHORT:  500,    // short Q&A
  MEDIUM: 2_000,  // moderate prompt
  LONG:   8_000,  // long context / document
  HUGE:   32_000, // needs 100k+ context window
} as const;

export function getTokenTier(tokens: number): 'short' | 'medium' | 'long' | 'huge' {
  if (tokens < TOKEN_THRESHOLDS.SHORT)  return 'short';
  if (tokens < TOKEN_THRESHOLDS.MEDIUM) return 'medium';
  if (tokens < TOKEN_THRESHOLDS.LONG)   return 'long';
  return 'huge';
}
