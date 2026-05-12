import { getServiceSupabase } from '../supabase';
import { embed } from './embed';
import type { IngestDocumentInput, IngestDocumentResult } from './types';

/**
 * Supermemory-style document ingestion with hierarchical chunking.
 *
 * Each document is split into ~2000 char parent chunks; each parent is split
 * into ~400 char child chunks. Retrieval can pull child chunks for precision
 * and follow `parent_chunk_id` for context expansion.
 */
const PARENT_CHUNK_SIZE = 2000;
const PARENT_OVERLAP = 200;
const CHILD_CHUNK_SIZE = 400;
const CHILD_OVERLAP = 50;

export async function ingestDocument(opts: IngestDocumentInput): Promise<IngestDocumentResult> {
  const db = getServiceSupabase();

  const { data: doc, error: docErr } = await db
    .from('memory_documents')
    .insert({
      workspace_id: opts.workspaceId,
      title:        opts.title,
      source_url:   opts.sourceUrl ?? null,
      source_type:  opts.sourceType,
      metadata:     opts.metadata ?? {},
    } as never)
    .select()
    .single();

  if (docErr || !doc) throw new Error(`ingestDocument: ${docErr?.message ?? 'no doc returned'}`);

  const docRow = doc as { id: string };
  const parents = chunkText(opts.rawText, PARENT_CHUNK_SIZE, PARENT_OVERLAP);

  let chunkIdx = 0;
  for (const parent of parents) {
    const parentEmbedding = await embed(parent);
    const { data: parentRow, error: parentErr } = await db
      .from('memory_chunks')
      .insert({
        document_id:   docRow.id,
        workspace_id:  opts.workspaceId,
        chunk_index:   chunkIdx++,
        content:       parent,
        embedding:     parentEmbedding,
      } as never)
      .select()
      .single();

    if (parentErr || !parentRow) {
      console.warn('[ingest] parent chunk insert failed:', parentErr);
      continue;
    }

    const children = chunkText(parent, CHILD_CHUNK_SIZE, CHILD_OVERLAP);
    if (children.length <= 1) continue;

    for (const child of children) {
      const childEmbedding = await embed(child);
      await db.from('memory_chunks').insert({
        document_id:      docRow.id,
        workspace_id:     opts.workspaceId,
        chunk_index:      chunkIdx++,
        parent_chunk_id:  (parentRow as { id: string }).id,
        content:          child,
        embedding:        childEmbedding,
      } as never);
    }
  }

  return { documentId: docRow.id, chunkCount: chunkIdx };
}

function chunkText(text: string, size: number, overlap: number): string[] {
  if (text.length <= size) return [text];

  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + size, text.length);
    let slice = text.slice(i, end);

    if (end < text.length) {
      const lastSpace = slice.lastIndexOf(' ');
      const lastNewline = slice.lastIndexOf('\n');
      const breakPoint = Math.max(lastSpace, lastNewline);
      if (breakPoint > size * 0.6) {
        slice = slice.slice(0, breakPoint);
        i += breakPoint - overlap;
      } else {
        i += size - overlap;
      }
    } else {
      i = text.length;
    }

    if (slice.trim().length > 0) out.push(slice.trim());
  }
  return out;
}
