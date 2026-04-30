export const YOUTUBE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
];

export function buildYouTubeOAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.YOUTUBE_CLIENT_ID || '';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YOUTUBE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${YOUTUBE_AUTH_URL}?${params.toString()}`;
}
