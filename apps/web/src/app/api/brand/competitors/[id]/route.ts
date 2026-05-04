import { NextResponse } from 'next/server';
import { nestProxy } from '@/lib/server/nestjs-proxy';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await nestProxy(`/brand/competitors/${id}`, { method: 'DELETE' });
  return NextResponse.json(data);
}
