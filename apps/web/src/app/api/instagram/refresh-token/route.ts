import { NextRequest, NextResponse } from 'next/server';
import { apiRequest, requireAuth, unauthorizedResponse } from '@/lib/meta/api-client';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth) return unauthorizedResponse();

  let connectionId: string | undefined;
  try {
    const body = await req.json();
    connectionId = body.connectionId;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId is required' }, { status: 400 });
  }

  const { data, error, status } = await apiRequest(
    `/meta/instagram/refresh-token/${connectionId}`,
    { method: 'POST' },
  );

  if (error) {
    return NextResponse.json({ error }, { status });
  }

  return NextResponse.json(data, { status: 200 });
}
