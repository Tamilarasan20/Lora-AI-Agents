import { NextResponse } from 'next/server';
import { nestProxy } from '@/lib/server/nestjs-proxy';

export async function GET() {
  const data = await nestProxy('/brand/competitors');
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const data = await nestProxy('/brand/competitors', { method: 'POST', body: JSON.stringify(body) });
  return NextResponse.json(data);
}
