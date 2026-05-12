/**
 * Loraloop Memory — public type surface.
 *
 * See docs/architecture/MEMORY.md for the design rationale.
 */

export type MemoryLayer =
  | 'brand'
  | 'campaign'
  | 'strategic'
  | 'preference'
  | 'reflection';

export type AgentScope =
  | 'shared'
  | 'lora'
  | 'sam'
  | 'sophie'
  | 'clara'
  | 'steve'
  | 'theo'
  | 'sarah'
  | 'elena'
  | 'nick'
  | 'aura'
  | 'echo'
  | 'nexus';

export type MemoryEventKind = 'add' | 'update' | 'delete' | 'noop';

export interface MemoryRecord {
  id: string;
  workspaceId: string;
  userId?: string | null;
  layer: MemoryLayer;
  agentScope: AgentScope;
  content: string;
  sourceType?: string | null;
  sourceId?: string | null;
  metadata: Record<string, unknown>;
  importance: number;
  confidence: number;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  supersededBy?: string | null;
}

export interface RetrievalQuery {
  workspaceId: string;
  query: string;
  layers?: MemoryLayer[];
  agentScopes?: AgentScope[];
  limit?: number;
  candidateN?: number;
  minImportance?: number;
  timeWindowDays?: number;
}

export interface RetrievalResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  layer: MemoryLayer;
  agentScope: AgentScope;
  importance: number;
  confidence: number;
  createdAt: string;
  score: number;
  source: 'vector' | 'bm25' | 'vector+bm25' | string;
}

export interface UpsertMemoryInput {
  id?: string;
  workspaceId: string;
  userId?: string | null;
  layer: MemoryLayer;
  agentScope: AgentScope;
  content: string;
  sourceType?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
  importance?: number;
  confidence?: number;
  expiresAt?: string | null;
}

export interface ReconcileInput {
  workspaceId: string;
  agentScope: AgentScope;
  layer: MemoryLayer;
  candidateFact: string;
  metadata?: Record<string, unknown>;
  sourceType?: string;
  sourceId?: string;
}

export interface ReconcileDecision {
  action: MemoryEventKind;
  targetId?: string;
  mergedContent?: string;
  reason: string;
}

export interface ExtractFactsInput {
  workspaceId: string;
  agentScope: AgentScope;
  layer: MemoryLayer;
  raw: string;
  metadata?: Record<string, unknown>;
  sourceType?: string;
  sourceId?: string;
}

export interface IngestDocumentInput {
  workspaceId: string;
  title: string;
  sourceType: 'web' | 'pdf' | 'notion' | 'analytics-csv' | 'transcript';
  sourceUrl?: string;
  rawText: string;
  metadata?: Record<string, unknown>;
}

export interface IngestDocumentResult {
  documentId: string;
  chunkCount: number;
}
