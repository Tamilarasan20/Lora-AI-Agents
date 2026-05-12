import { getServiceSupabase } from '../supabase';
import { embed } from './embed';
import type { RetrievalQuery, RetrievalResult } from './types';

interface RpcRow {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  layer: RetrievalResult['layer'];
  agent_scope: RetrievalResult['agentScope'];
  importance: number;
  confidence: number;
  created_at: string;
  score: number;
  source: string;
}

export async function retrieveMemories(q: RetrievalQuery): Promise<RetrievalResult[]> {
  const db = getServiceSupabase();
  const queryEmbedding = await embed(q.query);

  const { data, error } = await db.rpc('memories_hybrid_search', {
    workspace_id_in:  q.workspaceId,
    query_text:       q.query,
    query_embedding:  queryEmbedding,
    layers_in:        q.layers ?? null,
    scopes_in:        q.agentScopes ?? null,
    min_importance:   q.minImportance ?? 1,
    time_window_days: q.timeWindowDays ?? null,
    candidate_n:      q.candidateN ?? 50,
  } as never);

  if (error) throw new Error(`retrieveMemories: ${error.message}`);

  const rows = (data as RpcRow[] | null) ?? [];
  const mapped: RetrievalResult[] = rows.map((r) => ({
    id:          r.id,
    content:     r.content,
    metadata:    r.metadata ?? {},
    layer:       r.layer,
    agentScope:  r.agent_scope,
    importance:  r.importance,
    confidence:  r.confidence,
    createdAt:   r.created_at,
    score:       r.score,
    source:      r.source,
  }));

  const limit = q.limit ?? 8;
  return mapped.slice(0, limit);
}

export interface ChunkRetrievalQuery {
  workspaceId: string;
  query: string;
  limit?: number;
  candidateN?: number;
}

export interface ChunkRetrievalResult {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  chunkIndex: number;
  score: number;
  source: string;
}

export async function retrieveChunks(q: ChunkRetrievalQuery): Promise<ChunkRetrievalResult[]> {
  const db = getServiceSupabase();
  const queryEmbedding = await embed(q.query);

  const { data, error } = await db.rpc('memory_chunks_hybrid_search', {
    workspace_id_in: q.workspaceId,
    query_text:      q.query,
    query_embedding: queryEmbedding,
    candidate_n:     q.candidateN ?? 30,
  } as never);

  if (error) throw new Error(`retrieveChunks: ${error.message}`);

  interface ChunkRow {
    id: string;
    document_id: string;
    content: string;
    metadata: Record<string, unknown>;
    chunk_index: number;
    score: number;
    source: string;
  }

  const rows = (data as ChunkRow[] | null) ?? [];
  const mapped = rows.map((r) => ({
    id:         r.id,
    documentId: r.document_id,
    content:    r.content,
    metadata:   r.metadata ?? {},
    chunkIndex: r.chunk_index,
    score:      r.score,
    source:     r.source,
  }));

  return mapped.slice(0, q.limit ?? 10);
}

/**
 * Format retrieval results as a compact context block ready to inject into
 * an agent prompt.
 */
export function formatContextBlock(results: RetrievalResult[]): string {
  if (results.length === 0) return '';
  const lines = results.map((r, i) =>
    `[${i + 1}] (${r.layer}/${r.agentScope}, importance=${r.importance}) ${r.content}`,
  );
  return ['<memory_context>', ...lines, '</memory_context>'].join('\n');
}
