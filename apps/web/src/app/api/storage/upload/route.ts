// ─────────────────────────────────────────────────────────────────────────────
// /api/storage/upload — Next.js App Router route
//
// POST: proxy a multipart upload to NestJS
// GET:  proxy a file listing to NestJS
//
// Uses INTERNAL_API_URL (server-only, never exposed to the browser) so that
// internal network addresses are not leaked through the public env.
// Falls back to NEXT_PUBLIC_API_URL for local dev where both are the same.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const INTERNAL_API = process.env.INTERNAL_API_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'http://localhost:3000';

// ── Supabase server auth ───────────────────────────────────────────────────────
// Uses getUser() (verifies token with Supabase server) rather than
// getSession() (only decodes the JWT locally — does not detect revocation).

async function getAuthenticatedUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: ()    => cookieStore.getAll(),
        setAll: (cs)  => cs.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        ),
      },
    },
  );

  const [{ data: { user }, error }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  if (error || !user || !session) return null;
  return { user, accessToken: session.access_token };
}

// ── Helper: forward to NestJS with auth ──────────────────────────────────────

async function forwardToApi(
  url:         string,
  method:      string,
  accessToken: string,
  body?:       BodyInit,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...extraHeaders,
    },
    body,
  });
}

// ── POST /api/storage/upload ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const workspaceId      = searchParams.get('workspaceId');
  const category         = searchParams.get('category') || 'uploads';

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required.' }, { status: 400 });
  }

  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart request.' }, { status: 400 });
  }

  const apiUrl  = `${INTERNAL_API}/v1/workspaces/${workspaceId}/storage/upload?category=${encodeURIComponent(category)}`;

  let apiRes: Response;
  try {
    // Do NOT set Content-Type — fetch sets it automatically with the correct
    // multipart boundary when body is a FormData instance.
    apiRes = await forwardToApi(apiUrl, 'POST', auth.accessToken, formData);
  } catch (err) {
    console.error('[storage/upload] NestJS unreachable:', err);
    return NextResponse.json({ error: 'Storage service unavailable.' }, { status: 503 });
  }

  const data = await apiRes.json().catch(() => ({ error: 'Malformed API response.' }));

  return NextResponse.json(data, { status: apiRes.ok ? 201 : apiRes.status });
}

// ── GET /api/storage/upload (list files) ─────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const workspaceId      = searchParams.get('workspaceId');
  const category         = searchParams.get('category') || '';
  const page             = searchParams.get('page')  || '1';
  const limit            = searchParams.get('limit') || '20';

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required.' }, { status: 400 });
  }

  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const params = new URLSearchParams({ page, limit });
  if (category) params.set('category', category);

  const apiUrl = `${INTERNAL_API}/v1/workspaces/${workspaceId}/storage?${params}`;

  let apiRes: Response;
  try {
    apiRes = await forwardToApi(apiUrl, 'GET', auth.accessToken);
  } catch (err) {
    console.error('[storage/list] NestJS unreachable:', err);
    return NextResponse.json({ error: 'Storage service unavailable.' }, { status: 503 });
  }

  const data = await apiRes.json().catch(() => ({ error: 'Malformed API response.' }));
  return NextResponse.json(data, { status: apiRes.status });
}
