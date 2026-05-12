/**
 * POST /api/agents/nick
 * Performance analytics — winners, losers, insights, next actions
 */

import { NextResponse } from 'next/server';
import { runNick, type NickInput, type NickContentItem } from '@/lib/agents/nick';
import { loadBrandContext } from '@/lib/agents/_loadBrand';
import { meterIfAuthed } from '@/lib/withCredits';
import { extractAndStoreFacts } from '@/lib/memory';
import { getCurrentUser } from '@/lib/supabase-server';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<NickInput> & { businessId?: string };

    if (!Array.isArray(body.items)) {
      return NextResponse.json({ error: 'items must be an array of content performance records' }, { status: 400 });
    }

    const metered = await meterIfAuthed('nick', 'analyze');
    if (!metered.ok) return metered.response;

    const brand = await loadBrandContext(body.businessId);

    const result = await runNick({
      businessName: brand.businessName,
      brandVoice: brand.brandVoice,
      items: body.items as NickContentItem[],
      goal: body.goal,
      periodLabel: body.periodLabel,
    });

    // Fire-and-forget: extract reflection memories from Nick's analysis.
    // Reflections are the most valuable memory layer — they capture WHY
    // a campaign worked or didn't, which steers future strategy.
    const user = await getCurrentUser();
    if (user && result.insights?.length) {
      const raw = JSON.stringify({
        summary:  result.summary,
        winners:  result.winners,
        losers:   result.losers,
        insights: result.insights,
        patterns: result.patterns,
      });
      extractAndStoreFacts({
        workspaceId: user.id,
        agentScope:  'nick',
        layer:       'reflection',
        raw,
        sourceType:  'nick-analysis',
        metadata:    { period: result.period, verdict: result.scorecard?.overallVerdict },
      }).catch((err) => console.warn('[nick] memory extraction failed:', err));
    }

    return NextResponse.json({ agent: 'nick', remaining: metered.remaining, result });
  } catch (error) {
    console.error('[API/nick] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nick failed' },
      { status: 500 },
    );
  }
}
