import { NextResponse } from 'next/server';
import { nestProxy } from '@/lib/server/nestjs-proxy';

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.websiteUrl) {
    return NextResponse.json({ error: 'websiteUrl is required' }, { status: 400 });
  }
  const data = await nestProxy('/brand/analyze-website', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return NextResponse.json(data);
}
