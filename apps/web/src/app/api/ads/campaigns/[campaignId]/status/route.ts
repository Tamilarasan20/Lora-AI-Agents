import { NextRequest, NextResponse } from 'next/server';
import { apiRequest, requireAuth, unauthorizedResponse } from '@/lib/meta/api-client';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { campaignId: string } },
) {
  const auth = await requireAuth();
  if (!auth) return unauthorizedResponse();
  const body = await req.json().catch(() => ({}));
  const { data, error, status } = await apiRequest(
    `/meta-ads/campaigns/${params.campaignId}/status`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
