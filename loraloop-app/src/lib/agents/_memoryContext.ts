/**
 * Memory-orchestration helpers used by agent API routes.
 *
 * Before an agent runs:    `await getMemoryContext(...)` → pass into agent input
 * After an agent runs:     `void extractFacts(...)` (fire-and-forget)
 */

import {
  retrieveMemories,
  formatContextBlock,
  extractAndStoreFacts,
  type MemoryLayer,
  type AgentScope,
} from '@/lib/memory';

export interface GetMemoryContextOpts {
  workspaceId: string;
  query: string;
  layers: MemoryLayer[];
  agentScopes?: AgentScope[];
  limit?: number;
  minImportance?: number;
}

/**
 * Pull a formatted context block ready to inject into an agent prompt.
 * Returns an empty string if no memories match or retrieval fails — callers
 * should never have to handle a thrown error to keep the agent path working
 * on cold-start workspaces.
 */
export async function getMemoryContext(opts: GetMemoryContextOpts): Promise<string> {
  try {
    const results = await retrieveMemories({
      workspaceId:   opts.workspaceId,
      query:         opts.query,
      layers:        opts.layers,
      agentScopes:   opts.agentScopes ?? [...(opts.agentScopes ?? []), 'shared'] as AgentScope[],
      limit:         opts.limit ?? 8,
      minImportance: opts.minImportance ?? 1,
    });
    return formatContextBlock(results);
  } catch (err) {
    console.warn('[memory] getMemoryContext failed:', err);
    return '';
  }
}

export interface ExtractFactsOpts {
  workspaceId: string;
  agentScope: AgentScope;
  layer: MemoryLayer;
  raw: string;
  sourceType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget fact extraction. Always swallows errors — extraction
 * failures must not break the agent's user-facing response.
 */
export function extractFacts(opts: ExtractFactsOpts): void {
  extractAndStoreFacts(opts).catch((err) =>
    console.warn(`[memory] fact extraction failed for ${opts.agentScope}/${opts.layer}:`, err),
  );
}
