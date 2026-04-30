export const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
export const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
export const TIKTOK_API_URL = 'https://open.tiktokapis.com/v2';

export const TIKTOK_SCOPES = [
  'user.info.basic',
  'video.list',
  'video.upload',
  'video.publish',
];

export function buildTikTokOAuthUrl(state: string, redirectUri: string): string {
  const clientKey = process.env.TIKTOK_CLIENT_KEY || '';
  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: 'code',
    scope: TIKTOK_SCOPES.join(','),
    redirect_uri: redirectUri,
    state,
  });
  return `${TIKTOK_AUTH_URL}?${params.toString()}`;
}
