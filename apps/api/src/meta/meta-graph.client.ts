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

// ── Facebook Pages ─────────────────────────────────────────────────────────────

export interface FbPageInfo {
  id: string;
  name: string;
  category?: string;
  access_token: string;
  fan_count?: number;
  followers_count?: number;
  picture?: { data: { url: string } };
}

export async function getFbPages(accessToken: string): Promise<{ data: FbPageInfo[] }> {
  const p = new URLSearchParams({
    fields: 'id,name,category,access_token,fan_count,followers_count,picture',
    access_token: accessToken,
  });
  return graphFetch<{ data: FbPageInfo[] }>(`/me/accounts?${p.toString()}`);
}

export async function publishFbTextPost(params: {
  pageId: string;
  message: string;
  link?: string;
  accessToken: string;
}): Promise<{ id: string }> {
  const body: Record<string, string> = {
    message: params.message,
    access_token: params.accessToken,
  };
  if (params.link) body.link = params.link;
  return graphFetch<{ id: string }>(`/${params.pageId}/feed`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function publishFbPhotoPost(params: {
  pageId: string;
  imageUrl: string;
  caption?: string;
  accessToken: string;
}): Promise<{ id: string; post_id?: string }> {
  const body: Record<string, string | boolean> = {
    url: params.imageUrl,
    published: true,
    access_token: params.accessToken,
  };
  if (params.caption) body.caption = params.caption;
  return graphFetch<{ id: string; post_id?: string }>(`/${params.pageId}/photos`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function publishFbVideoPost(params: {
  pageId: string;
  videoUrl: string;
  description?: string;
  title?: string;
  accessToken: string;
}): Promise<{ id: string; video_id?: string }> {
  const body: Record<string, string> = {
    file_url: params.videoUrl,
    access_token: params.accessToken,
  };
  if (params.description) body.description = params.description;
  if (params.title) body.title = params.title;
  return graphFetch<{ id: string; video_id?: string }>(`/${params.pageId}/videos`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function scheduleFbPost(params: {
  pageId: string;
  message: string;
  scheduledPublishTime: number; // Unix timestamp
  link?: string;
  accessToken: string;
}): Promise<{ id: string }> {
  const body: Record<string, string | number | boolean> = {
    message: params.message,
    published: false,
    scheduled_publish_time: params.scheduledPublishTime,
    access_token: params.accessToken,
  };
  if (params.link) body.link = params.link as string;
  return graphFetch<{ id: string }>(`/${params.pageId}/feed`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface FbPageInsights {
  page_impressions?: number;
  page_reach?: number;
  page_engaged_users?: number;
  page_fan_count?: number;
  page_post_engagements?: number;
  page_views_total?: number;
}

export async function getFbPageInsights(
  pageId: string,
  accessToken: string,
  since?: Date,
  until?: Date,
): Promise<FbPageInsights> {
  const metrics = [
    'page_impressions',
    'page_reach',
    'page_engaged_users',
    'page_fan_count',
    'page_post_engagements',
    'page_views_total',
  ];
  const p = new URLSearchParams({
    metric: metrics.join(','),
    period: 'day',
    access_token: accessToken,
  });
  if (since) p.set('since', Math.floor(since.getTime() / 1000).toString());
  if (until) p.set('until', Math.floor(until.getTime() / 1000).toString());

  const res = await graphFetch<{ data: Array<{ name: string; values: Array<{ value: number }> }> }>(
    `/${pageId}/insights?${p.toString()}`,
  );

  const insights: FbPageInsights = {};
  for (const metric of res.data) {
    const latest = metric.values[metric.values.length - 1];
    if (latest) (insights as any)[metric.name] = latest.value;
  }
  return insights;
}

// ── Meta Marketing API (Ads) ──────────────────────────────────────────────────

export interface FbAdAccount {
  id: string;
  name: string;
  currency: string;
  timezone_name: string;
  account_status: number;
}

export async function getAdAccounts(accessToken: string): Promise<{ data: FbAdAccount[] }> {
  const p = new URLSearchParams({
    fields: 'id,name,currency,timezone_name,account_status',
    access_token: accessToken,
  });
  return graphFetch<{ data: FbAdAccount[] }>(`/me/adaccounts?${p.toString()}`);
}

export interface FbCampaign {
  id: string;
  name: string;
  objective: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

export async function getCampaigns(adAccountId: string, accessToken: string): Promise<{ data: FbCampaign[] }> {
  const p = new URLSearchParams({
    fields: 'id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time',
    access_token: accessToken,
  });
  return graphFetch<{ data: FbCampaign[] }>(`/act_${adAccountId}/campaigns?${p.toString()}`);
}

export async function createCampaign(params: {
  adAccountId: string;
  name: string;
  objective: string;
  status?: string;
  dailyBudget?: number;
  accessToken: string;
}): Promise<{ id: string }> {
  const body: Record<string, string | number> = {
    name: params.name,
    objective: params.objective,
    status: params.status ?? 'PAUSED',
    access_token: params.accessToken,
  };
  if (params.dailyBudget) body.daily_budget = params.dailyBudget * 100; // cents
  return graphFetch<{ id: string }>(`/act_${params.adAccountId}/campaigns`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateCampaignStatus(params: {
  campaignId: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  accessToken: string;
}): Promise<{ success: boolean }> {
  return graphFetch<{ success: boolean }>(`/${params.campaignId}`, {
    method: 'POST',
    body: JSON.stringify({ status: params.status, access_token: params.accessToken }),
  });
}

export interface FbAdSet {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  bid_amount?: string;
  targeting?: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
}

export async function getAdSets(
  adAccountId: string,
  accessToken: string,
  campaignId?: string,
): Promise<{ data: FbAdSet[] }> {
  const p = new URLSearchParams({
    fields: 'id,name,status,daily_budget,bid_amount,targeting,start_time,end_time',
    access_token: accessToken,
  });
  if (campaignId) p.set('campaign_id', campaignId);
  return graphFetch<{ data: FbAdSet[] }>(`/act_${adAccountId}/adsets?${p.toString()}`);
}

export interface FbAd {
  id: string;
  name: string;
  status: string;
  creative?: Record<string, unknown>;
}

export async function getAds(
  adAccountId: string,
  accessToken: string,
  adSetId?: string,
): Promise<{ data: FbAd[] }> {
  const p = new URLSearchParams({
    fields: 'id,name,status,creative',
    access_token: accessToken,
  });
  if (adSetId) p.set('adset_id', adSetId);
  return graphFetch<{ data: FbAd[] }>(`/act_${adAccountId}/ads?${p.toString()}`);
}

export interface FbInsight {
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  actions?: Array<{ action_type: string; value: string }>;
  date_start: string;
  date_stop: string;
}

export async function getAdInsights(params: {
  adAccountId: string;
  level: 'account' | 'campaign' | 'adset' | 'ad';
  datePreset?: string;
  since?: string;
  until?: string;
  entityId?: string;
  accessToken: string;
}): Promise<{ data: FbInsight[] }> {
  const p = new URLSearchParams({
    fields: 'impressions,clicks,spend,reach,cpm,cpc,ctr,actions',
    level: params.level,
    access_token: params.accessToken,
  });
  if (params.datePreset) p.set('date_preset', params.datePreset);
  if (params.since && params.until) {
    p.set('time_range', JSON.stringify({ since: params.since, until: params.until }));
  }

  const path = params.entityId
    ? `/${params.entityId}/insights?${p.toString()}`
    : `/act_${params.adAccountId}/insights?${p.toString()}`;

  return graphFetch<{ data: FbInsight[] }>(path);
}
