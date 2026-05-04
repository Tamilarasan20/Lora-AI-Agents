import { NextResponse } from 'next/server';
import { nestProxy } from '@/lib/server/nestjs-proxy';

export async function POST() {
  const data = await nestProxy('/brand/intelligence/dna/extract', { method: 'POST' });
  return NextResponse.json(data);
}
