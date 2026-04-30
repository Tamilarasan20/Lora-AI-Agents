import * as crypto from 'crypto';

export const TWITTER_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
export const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
export const TWITTER_API_URL = 'https://api.twitter.com/2';

export const TWITTER_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'offline.access',
  'dm.read',
  'dm.write',
];

export function buildTwitterOAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.TWITTER_CLIENT_ID || '';
  // PKCE: in real flow, codeVerifier is stored alongside state and used in token exchange.
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: TWITTER_SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${TWITTER_AUTH_URL}?${params.toString()}`;
}
