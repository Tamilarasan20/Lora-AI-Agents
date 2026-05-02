import { NextResponse } from 'next/server';
import { readBrandProfile, updateBrandProfile } from '@/lib/server/brand-store';

export async function GET() {
  return NextResponse.json(readBrandProfile().competitors);
}

export async function POST(request: Request) {
  const body = await request.json();
  const brand = readBrandProfile();
  const competitor = {
    id: crypto.randomUUID(),
    platform: body.platform ?? 'web',
    handle: body.handle ?? '',
    addedAt: new Date().toISOString(),
  };

  const updated = updateBrandProfile({
    competitors: [...brand.competitors, competitor],
  });

  return NextResponse.json(updated.competitors);
}
