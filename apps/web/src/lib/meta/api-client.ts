import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getSessionToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      },
    );
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<{ data: T | null; error: string | null; status: number }> {
  const token = await getSessionToken();
  if (!token) {
    return { data: null, error: 'Unauthorized', status: 401 };
  }

  try {
    const res = await fetch(`${API_BASE}/v1${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options?.headers ?? {}),
      },
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = body?.message ?? body?.error ?? `API error ${res.status}`;
      return { data: null, error: String(msg), status: res.status };
    }

    return { data: body as T, error: null, status: res.status };
  } catch (err) {
    return { data: null, error: (err as Error).message, status: 500 };
  }
}

export async function requireAuth(): Promise<{ userId: string; token: string } | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      },
    );
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    return { userId: session.user.id, token: session.access_token };
  } catch {
    return null;
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
