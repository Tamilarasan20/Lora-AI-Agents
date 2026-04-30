export const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
export const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
export const LINKEDIN_API_URL = 'https://api.linkedin.com/v2';

export const LINKEDIN_SCOPES = [
  'w_member_social',
  'r_liteprofile',
  'r_emailaddress',
  'r_organization_social',
];

export function buildLinkedInOAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.LINKEDIN_CLIENT_ID || '';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: LINKEDIN_SCOPES.join(' '),
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}
