import { NextResponse } from 'next/server';
import { apiRequest, requireAuth, unauthorizedResponse } from '@/lib/meta/api-client';

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return unauthorizedResponse();
  const { data, error, status } = await apiRequest('/meta-ads/accounts');
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json(data);
}
