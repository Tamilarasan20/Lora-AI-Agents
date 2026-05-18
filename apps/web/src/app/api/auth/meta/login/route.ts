import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  generateOAuthState,
  buildMetaOAuthUrl,
  STATE_COOKIE_NAME,
  STATE_COOKIE_OPTIONS,
} from '@/lib/meta/oauth';
import { requireAuth } from '@/lib/meta/api-client';

export async function GET() {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = generateOAuthState(auth.userId);
  const oauthUrl = buildMetaOAuthUrl(state);

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, state, STATE_COOKIE_OPTIONS);

  return NextResponse.redirect(oauthUrl);
}

export async function POST() {
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = generateOAuthState(auth.userId);
  const oauthUrl = buildMetaOAuthUrl(state);

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, state, STATE_COOKIE_OPTIONS);

  return NextResponse.json({ url: oauthUrl });
}
