import { NextRequest, NextResponse } from 'next/server';
import { apiRequest, requireAuth, unauthorizedResponse } from '@/lib/meta/api-client';

export async function GET(
  _req: NextRequest,
  { params }: { params: { accountId: string } },
) {
  const auth = await requireAuth();
  if (!auth) return unauthorizedResponse();
  const { data, error, status } = await apiRequest(
    `/meta-ads/accounts/${params.accountId}/campaigns`,
  );
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { accountId: string } },
) {
  const auth = await requireAuth();
  if (!auth) return unauthorizedResponse();
  const body = await req.json().catch(() => ({}));
  const { data, error, status } = await apiRequest(
    `/meta-ads/accounts/${params.accountId}/campaigns`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
