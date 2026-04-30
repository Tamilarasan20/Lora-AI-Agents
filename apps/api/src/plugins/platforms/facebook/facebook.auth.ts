export const FACEBOOK_AUTH_URL = 'https://www.facebook.com/v19.0/dialog/oauth';
export const FACEBOOK_TOKEN_URL = 'https://graph.facebook.com/v19.0/oauth/access_token';
export const FACEBOOK_API_URL = 'https://graph.facebook.com/v19.0';

export const FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'pages_manage_engagement',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_comments',
  'instagram_manage_insights',
  'public_profile',
  'email',
];

export function buildFacebookOAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.FACEBOOK_CLIENT_ID || '';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: FACEBOOK_SCOPES.join(','),
    response_type: 'code',
  });
  return `${FACEBOOK_AUTH_URL}?${params.toString()}`;
}
