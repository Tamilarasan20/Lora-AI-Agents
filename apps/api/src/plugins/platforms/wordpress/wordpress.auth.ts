// WordPress uses Application Passwords (introduced in WP 5.6) rather than OAuth.
// Users generate an application password from WP Admin → Users → Profile → Application Passwords.
// The credential is stored as Basic Auth: base64(username:app_password).

export function buildWordPressApiBase(siteUrl: string): string {
  return `${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2`;
}

export function buildWordPressAuthHeader(username: string, applicationPassword: string): string {
  const credentials = Buffer.from(`${username}:${applicationPassword}`).toString('base64');
  return `Basic ${credentials}`;
}

// No OAuth redirect URL needed; returns empty string to satisfy interface contract.
export function buildWordPressOAuthUrl(_state: string, _redirectUri: string): string {
  return '';
}
