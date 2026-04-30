export const PINTEREST_AUTH_URL = 'https://www.pinterest.com/oauth/';
export const PINTEREST_TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token';
export const PINTEREST_API_URL = 'https://api.pinterest.com/v5';

export const PINTEREST_SCOPES = [
  'boards:read',
  'boards:write',
  'pins:read',
  'pins:write',
  'user_accounts:read',
];

export function buildPinterestOAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.PINTEREST_CLIENT_ID || '';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: PINTEREST_SCOPES.join(','),
    state,
  });
  return `${PINTEREST_AUTH_URL}?${params.toString()}`;
}
