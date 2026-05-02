import { NextResponse } from 'next/server';
import { readBrandProfile, updateBrandProfile } from '@/lib/server/brand-store';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brand = readBrandProfile();
  const updated = updateBrandProfile({
    competitors: brand.competitors.filter((competitor) => competitor.id !== id),
  });
  return NextResponse.json(updated.competitors);
}
