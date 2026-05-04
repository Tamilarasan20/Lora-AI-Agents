import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

async function getBearerToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Proxy a request to the NestJS API and unwrap the { success, data } envelope. */
export async function nestProxy<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getBearerToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/v1${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> ?? {}) },
  });

  const json = await res.json();
  // Unwrap NestJS { success, data, timestamp } envelope
  return (json && typeof json === 'object' && 'success' in json && 'data' in json)
    ? json.data as T
    : json as T;
}
