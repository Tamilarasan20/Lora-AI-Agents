/**
 * Instagram / Meta OAuth constants — v23.0 Graph API.
 * Uses META_APP_ID / META_APP_SECRET (canonical names).
 * Backward-compatible: falls back to META_CLIENT_ID / META_CLIENT_SECRET.
 */

export const META_API_VERSION = 'v23.0';
export const INSTAGRAM_AUTH_URL = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth`;
export const INSTAGRAM_TOKEN_URL = `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`;
export const INSTAGRAM_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_comments',
  'instagram_manage_messages',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
];

export function buildInstagramOAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.META_APP_ID ?? process.env.META_CLIENT_ID ?? '';
  const configId = process.env.META_CONFIG_ID ?? '';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    scope: INSTAGRAM_SCOPES.join(','),
  });

  if (configId) params.set('config_id', configId);

  return `${INSTAGRAM_AUTH_URL}?${params.toString()}`;
}

export function getMetaClientId(): string {
  return process.env.META_APP_ID ?? process.env.META_CLIENT_ID ?? '';
}

export function getMetaClientSecret(): string {
  return process.env.META_APP_SECRET ?? process.env.META_CLIENT_SECRET ?? '';
}
