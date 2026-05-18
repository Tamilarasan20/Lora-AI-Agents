import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const STATE_COOKIE = 'meta_oauth_state';
const STATE_HMAC_SECRET = process.env.META_OAUTH_STATE_SECRET ?? process.env.ENCRYPTION_KEY ?? 'fallback_secret';

export const META_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
  'instagram_manage_comments',
  'instagram_manage_messages',
];

export function generateOAuthState(userId: string): string {
  const nonce = randomBytes(16).toString('hex');
  const payload = `${userId}:${nonce}`;
  const hmac = createHmac('sha256', STATE_HMAC_SECRET).update(payload).digest('hex');
  return `${payload}:${hmac}`;
}

export function validateOAuthState(state: string, storedState: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(state), Buffer.from(storedState));
  } catch {
    return false;
  }
}

export function buildMetaOAuthUrl(state: string): string {
  const clientId = process.env.META_APP_ID ?? '';
  const redirectUri = process.env.META_REDIRECT_URI ?? '';
  const configId = process.env.META_CONFIG_ID ?? '';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    config_id: configId,
    response_type: 'code',
    scope: META_SCOPES.join(','),
  });

  return `https://www.facebook.com/v23.0/dialog/oauth?${params.toString()}`;
}

export function setStateCookie(state: string, res?: Response): void {
  // Called server-side via cookies() from next/headers
}

export const STATE_COOKIE_NAME = STATE_COOKIE;
export const STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 600, // 10 minutes
};
