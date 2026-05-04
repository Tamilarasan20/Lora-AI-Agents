import { NextResponse } from 'next/server';
import { nestProxy } from '@/lib/server/nestjs-proxy';

export async function GET() {
  const data = await nestProxy('/brand/intelligence/dna');
  return NextResponse.json(data);
}
