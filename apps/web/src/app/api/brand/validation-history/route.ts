import { NextResponse } from 'next/server';
import { readBrandProfile } from '@/lib/server/brand-store';

export async function GET() {
  return NextResponse.json(readBrandProfile().validationHistory);
}
