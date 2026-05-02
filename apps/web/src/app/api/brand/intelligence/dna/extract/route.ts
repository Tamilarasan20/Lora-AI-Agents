import { NextResponse } from 'next/server';
import { readBrandProfile, updateBrandProfile } from '@/lib/server/brand-store';

export async function POST() {
  const brand = readBrandProfile();
  const dna = {
    ...brand.dna,
    extractedAt: new Date().toISOString(),
  };
  updateBrandProfile({ dna });
  return NextResponse.json(dna);
}
