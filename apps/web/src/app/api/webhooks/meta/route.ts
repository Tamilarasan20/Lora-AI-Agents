import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

// ── GET: Meta webhook verification challenge ─────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (
    mode === 'subscribe' &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN
  ) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

// ── POST: incoming webhook events ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Always return 200 immediately so Meta doesn't retry
  const signature = req.headers.get('x-hub-signature-256') ?? '';
  const rawBody = await req.text();

  // Validate HMAC signature
  if (!verifySignature(rawBody, signature)) {
    // Still return 200 to avoid Meta disabling the webhook
    console.warn('[Meta Webhook] Invalid signature');
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  // Forward to NestJS API asynchronously (fire-and-forget)
  void forwardToApi(body, signature).catch((err) =>
    console.error('[Meta Webhook] Forward failed', err),
  );

  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

function verifySignature(rawBody: string, signature: string): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature.startsWith('sha256=')) return false;

  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const received = signature.replace('sha256=', '');
    return timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

async function forwardToApi(body: unknown, signature: string): Promise<void> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3000';
  const res = await fetch(`${apiUrl}/v1/meta/webhooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signature,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`[Meta Webhook] API forward returned ${res.status}`);
  }
}
