import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  validateOAuthState,
  STATE_COOKIE_NAME,
} from '@/lib/meta/oauth';
import { apiRequest, requireAuth } from '@/lib/meta/api-client';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://loraloop.com';

  // Meta returned an error (user denied, etc.)
  if (error) {
    const msg = encodeURIComponent(errorDescription ?? error);
    return NextResponse.redirect(`${appUrl}/dashboard/instagram?error=${msg}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard/instagram?error=missing_params`);
  }

  // CSRF: validate state against cookie
  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE_NAME)?.value;

  if (!storedState || !validateOAuthState(state, storedState)) {
    return NextResponse.redirect(`${appUrl}/dashboard/instagram?error=invalid_state`);
  }

  // Clear the state cookie
  cookieStore.delete(STATE_COOKIE_NAME);

  // Ensure the user is still logged in
  const auth = await requireAuth();
  if (!auth) {
    return NextResponse.redirect(`${appUrl}/login?next=/dashboard/instagram`);
  }

  // Hand off to NestJS API to complete the OAuth exchange
  const { data, error: apiError } = await apiRequest<{ connectionId: string; instagramAccounts: unknown[] }>(
    '/meta/oauth/complete',
    {
      method: 'POST',
      body: JSON.stringify({ code }),
    },
  );

  if (apiError || !data) {
    const msg = encodeURIComponent(apiError ?? 'oauth_failed');
    return NextResponse.redirect(`${appUrl}/dashboard/instagram?error=${msg}`);
  }

  const count = data.instagramAccounts?.length ?? 0;
  return NextResponse.redirect(
    `${appUrl}/dashboard/instagram?connected=true&accounts=${count}`,
  );
}
