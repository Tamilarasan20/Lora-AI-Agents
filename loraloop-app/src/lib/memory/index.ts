/**
 * Loraloop Memory — public SDK.
 *
 * Usage from any agent:
 *
 *   import { retrieveMemories, extractAndStoreFacts, formatContextBlock } from '@/lib/memory';
 *
 *   // Pull context before running
 *   const ctx = await retrieveMemories({
 *     workspaceId, query: goal,
 *     layers: ['strategic', 'reflection'], limit: 8,
 *   });
 *
 *   // Inject into prompt
 *   const prompt = `${formatContextBlock(ctx)}\n\n${userGoal}`;
 *
 *   // After running, extract durable facts
 *   await extractAndStoreFacts({
 *     workspaceId, agentScope: 'lora', layer: 'strategic',
 *     raw: agentOutput,
 *   });
 *
 * See docs/architecture/MEMORY.md for the full design.
 */

export * from './types';
export { embed, embedBatch, EMBED_MODEL, EMBED_DIMENSIONS } from './embed';
export {
  upsertMemory,
  supersedeMemory,
  deleteMemory,
  getMemoryById,
  logEvent,
} from './store';
export {
  retrieveMemories,
  retrieveChunks,
  formatContextBlock,
} from './retrieve';
export type {
  ChunkRetrievalQuery,
  ChunkRetrievalResult,
} from './retrieve';
export { reconcileFact } from './reconcile';
export { extractAndStoreFacts } from './extract';
export { ingestDocument } from './ingest';
