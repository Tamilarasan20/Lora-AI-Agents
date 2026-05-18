import { NextRequest, NextResponse } from 'next/server';
import { apiRequest, requireAuth, unauthorizedResponse } from '@/lib/meta/api-client';

export async function GET(
  req: NextRequest,
  { params }: { params: { pageId: string } },
) {
  const auth = await requireAuth();
  if (!auth) return unauthorizedResponse();
  const { searchParams } = new URL(req.url);
  const since = searchParams.get('since') ?? '';
  const until = searchParams.get('until') ?? '';
  const query = new URLSearchParams();
  if (since) query.set('since', since);
  if (until) query.set('until', until);
  const qs = query.toString();
  const { data, error, status } = await apiRequest(
    `/facebook/pages/${params.pageId}/insights${qs ? `?${qs}` : ''}`,
  );
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
