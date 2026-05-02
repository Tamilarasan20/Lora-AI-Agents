import { NextResponse } from 'next/server';
import { readBrandProfile } from '@/lib/server/brand-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') ?? '10');
  return NextResponse.json(readBrandProfile().memory.slice(0, limit));
}
