/**
 * POST /api/agents/orchestrate
 * Main orchestration endpoint
 */

import { NextResponse } from 'next/server';
import { OrchestratorInput } from '@/types/agents';
import { orchestrateContent, prettyPrintOutput } from '@/lib/agents/orchestrator';
import { getCurrentUser } from '@/lib/supabase-server';

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<OrchestratorInput>;

    // Validate
    if (!body.goal || !body.platform || !body.contentTypes || body.contentTypes.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: goal, platform, contentTypes' }, { status: 400 });
    }

    console.log('[API] POST /api/agents/orchestrate', {
      goal: body.goal,
      platform: body.platform,
      contentTypes: body.contentTypes,
    });

    // Resolve workspaceId from the authenticated user so the orchestrator can
    // pull strategic + brand + reflection memory for Lora and Clara. If the
    // caller is anonymous (e.g. mock-data demo), orchestration still runs
    // cold without memory.
    const user = await getCurrentUser();

    // Run orchestration
    const result = await orchestrateContent({
      businessId: body.businessId,
      workspaceId: user?.id,
      goal: body.goal,
      platform: body.platform,
      contentTypes: body.contentTypes,
      useMockData: body.useMockData,
      preferences: body.preferences,
    });

    console.log('[API] ✅ Success');
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Orchestration failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return new NextResponse(`
# Loraloop AI Growth Pod Orchestrator API

## POST /api/agents/orchestrate

### Request Body
{
  "goal": "string (required)",
  "platform": "instagram|twitter|linkedin|tiktok|blog (required)",
  "contentTypes": ["image", "text"] (required),
  "useMockData": true (optional),
  "businessId": "uuid" (optional),
  "preferences": { "style": "...", ... } (optional)
}

### Response
{
  "image": { "url": "...", "prompt": "...", "metadata": {...} },
  "text": { "caption": "...", "hashtags": [...], "keyPhrases": [...] },
  "metadata": {...}
}

### Example
curl -X POST http://localhost:3000/api/agents/orchestrate \\
  -H "Content-Type: application/json" \\
  -d '{
    "goal": "Announce Q2 launch",
    "platform": "instagram",
    "contentTypes": ["image", "text"],
    "useMockData": true
  }'
  `, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
