import { NextResponse } from 'next/server';
import { analyzeWebsite } from '@/lib/server/brand-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.websiteUrl) {
      return NextResponse.json({ error: 'websiteUrl is required' }, { status: 400 });
    }

    const result = await analyzeWebsite(body.websiteUrl);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
