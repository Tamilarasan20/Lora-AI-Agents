import { NextResponse } from 'next/server';
import { nestProxy } from '@/lib/server/nestjs-proxy';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') ?? '10';
  const data = await nestProxy(`/brand/intelligence/memory?limit=${limit}`);
  return NextResponse.json(data);
}
