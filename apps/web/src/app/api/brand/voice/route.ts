import { NextResponse } from 'next/server';
import { nestProxy } from '@/lib/server/nestjs-proxy';

export async function GET() {
  const data = await nestProxy('/brand/voice');
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const body = await request.json();
  const data = await nestProxy('/brand/voice', { method: 'PUT', body: JSON.stringify(body) });
  return NextResponse.json(data);
}
