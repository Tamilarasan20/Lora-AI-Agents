import { getServiceSupabase } from '../supabase';
import { embed } from './embed';
import type { MemoryRecord, UpsertMemoryInput, MemoryEventKind } from './types';

interface MemoryRow {
  id: string;
  workspace_id: string;
  user_id: string | null;
  layer: MemoryRecord['layer'];
  agent_scope: MemoryRecord['agentScope'];
  content: string;
  source_type: string | null;
  source_id: string | null;
  metadata: Record<string, unknown>;
  importance: number;
  confidence: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  superseded_by: string | null;
}

function mapRow(row: MemoryRow): MemoryRecord {
  return {
    id:           row.id,
    workspaceId:  row.workspace_id,
    userId:       row.user_id,
    layer:        row.layer,
    agentScope:   row.agent_scope,
    content:      row.content,
    sourceType:   row.source_type,
    sourceId:     row.source_id,
    metadata:     row.metadata ?? {},
    importance:   row.importance,
    confidence:   row.confidence,
    expiresAt:    row.expires_at,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
    supersededBy: row.superseded_by,
  };
}

export async function upsertMemory(input: UpsertMemoryInput): Promise<MemoryRecord> {
  const db = getServiceSupabase();
  const embedding = await embed(input.content);

  const payload = {
    id:           input.id,
    workspace_id: input.workspaceId,
    user_id:      input.userId ?? null,
    layer:        input.layer,
    agent_scope:  input.agentScope,
    content:      input.content,
    source_type:  input.sourceType ?? null,
    source_id:    input.sourceId ?? null,
    metadata:     input.metadata ?? {},
    importance:   input.importance ?? 5,
    confidence:   input.confidence ?? 1.0,
    expires_at:   input.expiresAt ?? null,
    embedding,
    updated_at:   new Date().toISOString(),
  };

  const { data, error } = await db
    .from('memories')
    .upsert(payload as never)
    .select()
    .single();

  if (error) throw new Error(`upsertMemory: ${error.message}`);
  const record = mapRow(data as MemoryRow);

  await logEvent({
    workspaceId: record.workspaceId,
    memoryId:    record.id,
    agent:       record.agentScope,
    kind:        input.id ? 'update' : 'add',
    delta:       { content: record.content },
  });

  return record;
}

export async function supersedeMemory(oldId: string, newId: string | null): Promise<void> {
  const db = getServiceSupabase();
  const { error } = await db
    .from('memories')
    .update({ superseded_by: newId, updated_at: new Date().toISOString() })
    .eq('id', oldId);
  if (error) throw new Error(`supersedeMemory: ${error.message}`);
}

export async function deleteMemory(id: string): Promise<void> {
  const db = getServiceSupabase();
  const { data } = await db.from('memories').select('workspace_id').eq('id', id).single();
  await supersedeMemory(id, id);
  if (data) {
    await logEvent({
      workspaceId: (data as { workspace_id: string }).workspace_id,
      memoryId:    id,
      agent:       'system',
      kind:        'delete',
    });
  }
}

export async function getMemoryById(id: string): Promise<MemoryRecord | null> {
  const db = getServiceSupabase();
  const { data, error } = await db.from('memories').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`getMemoryById: ${error.message}`);
  return data ? mapRow(data as MemoryRow) : null;
}

interface LogEventInput {
  workspaceId: string;
  memoryId?:   string | null;
  agent?:      string;
  kind:        MemoryEventKind;
  delta?:      Record<string, unknown>;
}

export async function logEvent(input: LogEventInput): Promise<void> {
  const db = getServiceSupabase();
  await db.from('memory_events').insert({
    workspace_id: input.workspaceId,
    memory_id:    input.memoryId ?? null,
    agent:        input.agent ?? null,
    kind:         input.kind,
    delta:        input.delta ?? null,
  } as never);
}
