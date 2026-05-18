import { NextRequest, NextResponse } from 'next/server';
import { apiRequest, requireAuth, unauthorizedResponse } from '@/lib/meta/api-client';

export async function GET(
  req: NextRequest,
  { params }: { params: { accountId: string } },
) {
  const auth = await requireAuth();
  if (!auth) return unauthorizedResponse();
  const { searchParams } = new URL(req.url);
  const datePreset = searchParams.get('datePreset') ?? '';
  const query = new URLSearchParams();
  if (datePreset) query.set('datePreset', datePreset);
  const qs = query.toString();
  const { data, error, status } = await apiRequest(
    `/meta-ads/accounts/${params.accountId}/insights${qs ? `?${qs}` : ''}`,
  );
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
