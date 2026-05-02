import { NextResponse } from 'next/server';
import { readBrandProfile, updateBrandProfile } from '@/lib/server/brand-store';

export async function GET() {
  return NextResponse.json(readBrandProfile());
}

export async function PUT(request: Request) {
  const body = await request.json();
  return NextResponse.json(updateBrandProfile(body));
}

export async function PATCH(request: Request) {
  const body = await request.json();
  return NextResponse.json(updateBrandProfile(body));
}
