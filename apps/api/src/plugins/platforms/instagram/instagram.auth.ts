/**
 * Instagram OAuth helpers (uses Meta/Facebook OAuth flow with Instagram permissions).
 *
 * Real token exchange + user-info fetch is wired in Phase 6 inside the plugin.
 */
export const INSTAGRAM_AUTH_URL = 'https://www.facebook.com/v20.0/dialog/oauth';
export const INSTAGRAM_TOKEN_URL = 'https://graph.facebook.com/v20.0/oauth/access_token';
export const INSTAGRAM_GRAPH_URL = 'https://graph.facebook.com/v20.0';

export const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_comments',
  'pages_show_list',
  'pages_read_engagement',
];

export function buildInstagramOAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.META_CLIENT_ID || '';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: INSTAGRAM_SCOPES.join(','),
    response_type: 'code',
  });
  return `${INSTAGRAM_AUTH_URL}?${params.toString()}`;
}
