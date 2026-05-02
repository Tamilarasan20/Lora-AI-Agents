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

/**
 * In-process store that maps OAuth state → PKCE code verifier.
 * The connections service calls storeVerifier() right after buildTwitterOAuthUrl()
 * and calls retrieveVerifier() inside exchangeCode().
 */
const verifierStore = new Map<string, string>();

export function storeVerifier(state: string, codeVerifier: string): void {
  verifierStore.set(state, codeVerifier);
}

export function retrieveVerifier(state: string): string | undefined {
  const verifier = verifierStore.get(state);
  verifierStore.delete(state); // consume once
  return verifier;
}

export function buildTwitterOAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.TWITTER_CLIENT_ID || '';
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  // Persist verifier so exchangeCode() can look it up by state.
  storeVerifier(state, codeVerifier);

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
