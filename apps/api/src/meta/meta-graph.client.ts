import { Logger } from '@nestjs/common';

export const META_API_VERSION = 'v23.0';
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
export const META_OAUTH_BASE = `https://www.facebook.com/${META_API_VERSION}`;

export class MetaApiError extends Error {
  constructor(
    public readonly code: number,
    public readonly subcode: number | undefined,
    message: string,
    public readonly type: string,
  ) {
    super(message);
    this.name = 'MetaApiError';
  }

  get isTokenExpired() {
    return this.code === 190;
  }

  get isRateLimited() {
    return this.code === 4 || this.code === 17 || this.code === 32 || this.code === 613;
  }

  get isPermissionError() {
    return this.code === 10 || this.code === 200;
  }
}

export interface MetaPageInfo {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

export interface MetaIgProfile {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  biography?: string;
  website?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
}

export interface MetaShortTokenResponse {
  access_token: string;
  token_type: string;
}

export interface MetaLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface MetaTokenDebugResponse {
  data: {
    app_id: string;
    type: string;
    expires_at: number;
    is_valid: boolean;
    issued_at?: number;
    scopes: string[];
    user_id?: string;
  };
}

export interface IgMediaContainerResponse {
  id: string;
}

export interface IgPublishResponse {
  id: string;
}

export interface IgCarouselItemContainer {
  id: string;
}

const logger = new Logger('MetaGraphClient');

async function graphFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith('http') ? path : `${META_GRAPH_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const body = await res.json() as T & { error?: { code: number; error_subcode?: number; message: string; type: string } };

  if (!res.ok || (body as any).error) {
    const err = (body as any).error ?? { code: res.status, message: 'Unknown Meta API error', type: 'UnknownError' };
    logger.error(`Meta API error ${err.code}: ${err.message}`);
    throw new MetaApiError(err.code, err.error_subcode, err.message, err.type);
  }

  return body;
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

export function buildMetaOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  configId: string;
  scopes: string[];
}): string {
  const p = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    state: params.state,
    config_id: params.configId,
    response_type: 'code',
    scope: params.scopes.join(','),
  });
  return `${META_OAUTH_BASE}/dialog/oauth?${p.toString()}`;
}

export async function exchangeCodeForShortToken(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<MetaShortTokenResponse> {
  const p = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
  });
  const url = `${META_GRAPH_BASE}/oauth/access_token?${p.toString()}`;
  return graphFetch<MetaShortTokenResponse>(url);
}

export async function exchangeForLongLivedToken(params: {
  clientId: string;
  clientSecret: string;
  shortLivedToken: string;
}): Promise<MetaLongLivedTokenResponse> {
  const p = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: params.clientId,
    client_secret: params.clientSecret,
    fb_exchange_token: params.shortLivedToken,
  });
  const url = `${META_GRAPH_BASE}/oauth/access_token?${p.toString()}`;
  return graphFetch<MetaLongLivedTokenResponse>(url);
}

export async function refreshLongLivedToken(params: {
  accessToken: string;
  clientSecret: string;
}): Promise<MetaLongLivedTokenResponse> {
  const p = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: params.accessToken,
  });
  const url = `${META_GRAPH_BASE}/refresh_access_token?${p.toString()}`;
  return graphFetch<MetaLongLivedTokenResponse>(url);
}

export async function debugToken(params: {
  inputToken: string;
  accessToken: string;
}): Promise<MetaTokenDebugResponse> {
  const p = new URLSearchParams({
    input_token: params.inputToken,
    access_token: params.accessToken,
  });
  return graphFetch<MetaTokenDebugResponse>(`/debug_token?${p.toString()}`);
}

export async function getMe(accessToken: string): Promise<{ id: string; name?: string }> {
  return graphFetch(`/me?fields=id,name&access_token=${accessToken}`);
}

export async function getPages(accessToken: string): Promise<{ data: MetaPageInfo[] }> {
  const p = new URLSearchParams({
    fields: 'id,name,access_token,instagram_business_account',
    access_token: accessToken,
  });
  return graphFetch<{ data: MetaPageInfo[] }>(`/me/accounts?${p.toString()}`);
}

export async function getIgProfile(igAccountId: string, accessToken: string): Promise<MetaIgProfile> {
  const p = new URLSearchParams({
    fields: 'id,username,name,profile_picture_url,biography,website,followers_count,follows_count,media_count',
    access_token: accessToken,
  });
  return graphFetch<MetaIgProfile>(`/${igAccountId}?${p.toString()}`);
}

// ── Media Publishing ──────────────────────────────────────────────────────────

export interface IgImagePublishParams {
  igAccountId: string;
  imageUrl: string;
  caption?: string;
  accessToken: string;
}

export interface IgReelPublishParams {
  igAccountId: string;
  videoUrl: string;
  caption?: string;
  shareToFeed?: boolean;
  accessToken: string;
}

export interface IgCarouselPublishParams {
  igAccountId: string;
  mediaUrls: string[];
  caption?: string;
  accessToken: string;
}

export async function createIgImageContainer(params: IgImagePublishParams): Promise<IgMediaContainerResponse> {
  const body: Record<string, string | boolean> = {
    image_url: params.imageUrl,
    is_carousel_item: false,
    access_token: params.accessToken,
  };
  if (params.caption) body.caption = params.caption;

  return graphFetch<IgMediaContainerResponse>(`/${params.igAccountId}/media`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createIgCarouselItemContainer(params: {
  igAccountId: string;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  accessToken: string;
}): Promise<IgCarouselItemContainer> {
  return graphFetch<IgCarouselItemContainer>(`/${params.igAccountId}/media`, {
    method: 'POST',
    body: JSON.stringify({
      [params.mediaType === 'IMAGE' ? 'image_url' : 'video_url']: params.mediaUrl,
      media_type: params.mediaType,
      is_carousel_item: true,
      access_token: params.accessToken,
    }),
  });
}

export async function createIgCarouselContainer(params: IgCarouselPublishParams & { itemIds: string[] }): Promise<IgMediaContainerResponse> {
  const body: Record<string, string | string[]> = {
    media_type: 'CAROUSEL',
    children: params.itemIds,
    access_token: params.accessToken,
  };
  if (params.caption) body.caption = params.caption;

  return graphFetch<IgMediaContainerResponse>(`/${params.igAccountId}/media`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createIgReelContainer(params: IgReelPublishParams): Promise<IgMediaContainerResponse> {
  const body: Record<string, string | boolean> = {
    media_type: 'REELS',
    video_url: params.videoUrl,
    access_token: params.accessToken,
    share_to_feed: params.shareToFeed ?? true,
  };
  if (params.caption) body.caption = params.caption;

  return graphFetch<IgMediaContainerResponse>(`/${params.igAccountId}/media`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function checkContainerStatus(containerId: string, accessToken: string): Promise<{ status_code: string; status?: string }> {
  const p = new URLSearchParams({ fields: 'status_code,status', access_token: accessToken });
  return graphFetch(`/${containerId}?${p.toString()}`);
}

export async function publishIgContainer(params: {
  igAccountId: string;
  containerId: string;
  accessToken: string;
}): Promise<IgPublishResponse> {
  return graphFetch<IgPublishResponse>(`/${params.igAccountId}/media_publish`, {
    method: 'POST',
    body: JSON.stringify({
      creation_id: params.containerId,
      access_token: params.accessToken,
    }),
  });
}

export async function waitForContainerReady(
  containerId: string,
  accessToken: string,
  maxWaitMs = 60_000,
): Promise<void> {
  const interval = 3_000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const status = await checkContainerStatus(containerId, accessToken);
    if (status.status_code === 'FINISHED') return;
    if (status.status_code === 'ERROR') {
      throw new MetaApiError(0, undefined, `Container ${containerId} failed: ${status.status ?? 'unknown'}`, 'ContainerError');
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new MetaApiError(0, undefined, `Container ${containerId} not ready after ${maxWaitMs}ms`, 'Timeout');
}
