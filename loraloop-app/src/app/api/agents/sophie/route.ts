/**
 * POST /api/agents/sophie
 * SEO + GEO optimisation brief
 */

import { NextResponse } from 'next/server';
import { runSophie, type SophieInput } from '@/lib/agents/sophie';
import { loadBrandContext } from '@/lib/agents/_loadBrand';
import { meterIfAuthed } from '@/lib/withCredits';
import { getCurrentUser } from '@/lib/supabase-server';
import { getMemoryContext, extractFacts } from '@/lib/agents/_memoryContext';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<SophieInput> & { businessId?: string };

    if (!body.topic) {
      return NextResponse.json({ error: 'Missing required field: topic' }, { status: 400 });
    }

    const metered = await meterIfAuthed('sophie', 'seo');
    if (!metered.ok) return metered.response;

    const brand = await loadBrandContext(body.businessId);
    const user = await getCurrentUser();

    const memoryContext = user
      ? await getMemoryContext({
          workspaceId: user.id,
          query:       body.topic,
          layers:      ['brand', 'strategic', 'reflection'],
          agentScopes: ['sophie', 'shared'],
          limit:       8,
        })
      : '';

    const result = await runSophie({
      topic: body.topic,
      businessName: brand.businessName,
      brandVoice: brand.brandVoice,
      platform: body.platform,
      targetKeywords: body.targetKeywords,
      audience: body.audience,
      existingContent: body.existingContent,
      memoryContext,
    });

    if (user) {
      extractFacts({
        workspaceId: user.id,
        agentScope:  'sophie',
        layer:       'strategic',
        raw:         JSON.stringify({ topic: body.topic, brief: result }),
        sourceType:  'sophie-brief',
        metadata:    { topic: body.topic, primaryKeyword: result.primaryKeyword },
      });
    }

    return NextResponse.json({ agent: 'sophie', remaining: metered.remaining, result });
  } catch (error) {
    console.error('[API/sophie] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sophie failed' },
      { status: 500 },
    );
  }
}
