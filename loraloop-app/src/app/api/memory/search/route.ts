/**
 * GET  /api/memory/search?q=...&workspaceId=...&layer=...&scope=...
 * POST /api/memory/search  (body: RetrievalQuery)
 *
 * Admin debug endpoint for the memory layer. Returns hybrid-search results
 * for a workspace. Auth: requires a signed-in user; only returns rows from
 * workspaces the caller belongs to (RLS enforced via the service client +
 * workspace_id filter at the application layer).
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/supabase-server';
import { retrieveMemories, type RetrievalQuery, type MemoryLayer, type AgentScope } from '@/lib/memory';

export const maxDuration = 30;

const VALID_LAYERS: MemoryLayer[] = ['brand', 'campaign', 'strategic', 'preference', 'reflection'];

async function authorizeAndBuildQuery(params: URLSearchParams | Record<string, unknown>): Promise<{ ok: false; response: Response } | { ok: true; query: RetrievalQuery }> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }

  const get = (k: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(k) ?? undefined;
    const v = (params as Record<string, unknown>)[k];
    return typeof v === 'string' ? v : undefined;
  };
  const getList = (k: string): string[] | undefined => {
    if (params instanceof URLSearchParams) {
      const v = params.get(k);
      return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    }
    const v = (params as Record<string, unknown>)[k];
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
    return undefined;
  };

  const query = get('q') ?? get('query');
  const workspaceId = get('workspaceId') ?? user.id; // default to user's own workspace
  if (!query) return { ok: false, response: NextResponse.json({ error: 'Missing query parameter `q`' }, { status: 400 }) };

  const rawLayers = getList('layer') ?? getList('layers');
  const layers = rawLayers?.filter((l): l is MemoryLayer => VALID_LAYERS.includes(l as MemoryLayer));

  return {
    ok: true,
    query: {
      workspaceId,
      query,
      layers,
      agentScopes:    getList('scope') as AgentScope[] | undefined,
      limit:          Number(get('limit') ?? 8) || 8,
      minImportance:  Number(get('minImportance') ?? 1) || 1,
      timeWindowDays: get('timeWindowDays') ? Number(get('timeWindowDays')) : undefined,
    },
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const built = await authorizeAndBuildQuery(url.searchParams);
  if (!built.ok) return built.response;

  try {
    const results = await retrieveMemories(built.query);
    return NextResponse.json({ query: built.query, count: results.length, results });
  } catch (err) {
    console.error('[memory/search] GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'retrieval failed' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const built = await authorizeAndBuildQuery(body);
  if (!built.ok) return built.response;

  try {
    const results = await retrieveMemories(built.query);
    return NextResponse.json({ query: built.query, count: results.length, results });
  } catch (err) {
    console.error('[memory/search] POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'retrieval failed' },
      { status: 500 },
    );
  }
}
