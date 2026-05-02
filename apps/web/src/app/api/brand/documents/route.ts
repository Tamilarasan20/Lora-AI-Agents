import { NextResponse } from 'next/server';
import { documentUrls, readBrandProfile } from '@/lib/server/brand-store';

export async function GET() {
  return NextResponse.json(documentUrls(readBrandProfile()));
}
