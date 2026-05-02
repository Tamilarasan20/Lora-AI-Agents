import { NextResponse } from 'next/server';
import { readBrandProfile, updateBrandProfile } from '@/lib/server/brand-store';

export async function GET() {
  const brand = readBrandProfile();
  return NextResponse.json({
    tone: brand.tone,
    voiceCharacteristics: brand.voiceCharacteristics,
    brandDescription: brand.productDescription,
    valueProposition: brand.valueProposition,
    autoReplyEnabled: brand.autoReplyEnabled,
    sentimentThreshold: brand.sentimentThreshold,
  });
}

export async function PUT(request: Request) {
  const body = await request.json();
  return NextResponse.json(
    updateBrandProfile({
      tone: body.tone,
      voiceCharacteristics: body.voiceCharacteristics,
      productDescription: body.brandDescription,
      valueProposition: body.valueProposition,
      autoReplyEnabled: body.autoReplyEnabled,
      sentimentThreshold: body.sentimentThreshold,
    }),
  );
}
