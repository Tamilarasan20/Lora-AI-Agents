import { NextRequest, NextResponse } from 'next/server';
import { apiRequest, requireAuth, unauthorizedResponse } from '@/lib/meta/api-client';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { data, error, status } = await apiRequest('/meta/instagram/publish', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (error) {
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json(data, { status: 200 });
}
