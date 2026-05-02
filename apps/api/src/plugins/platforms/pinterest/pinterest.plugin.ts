import { BasePlatformPlugin } from '../../base-plugin';
import {
  PlatformFeatures,
  ContentConstraints,
  RawContent,
  BrandContext,
  AdaptedContent,
  RateLimitConfig,
  OAuthTokens,
  Credentials,
  PublishResult,
  PostAnalytics,
  Comment,
  ReplyResult,
  NotImplementedError,
} from '../../platform-plugin.interface';
import { buildPinterestOAuthUrl, PINTEREST_TOKEN_URL, PINTEREST_API_URL } from './pinterest.auth';

// ─── shared helper ────────────────────────────────────────────────────────────

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    let message = `Pinterest API error ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; error?: string; error_description?: string };
      message = body.message ?? body.error_description ?? body.error ?? message;
    } catch {
      // ignore JSON parse errors — keep the default message
    }
    throw new Error(message);
  }
}

// ─── plugin ───────────────────────────────────────────────────────────────────

export class PinterestPlugin extends BasePlatformPlugin {
  readonly platformName = 'pinterest';
  readonly displayName = 'Pinterest';
  readonly version = '1.0.0';
  readonly supportedFeatures: PlatformFeatures = {
    publishing: true,
    scheduling: true,
    analytics: true,
    engagement: false,
    dms: false,
    stories: false,
    reels: false,
    carousels: false,
    videos: true,
    webhooks: false,
  };

  getContentConstraints(): ContentConstraints {
    return {
      maxCaptionLength: 500,
      maxHashtags: 20,
      maxMentions: 0,
      supportedMediaTypes: ['image', 'video'],
      maxVideoDurationSec: 900,
      maxFileSizeMb: 2048,
    };
  }

  getRateLimitInfo(): RateLimitConfig {
    return {
      requestsPerHour: 100,
      requestsPerDay: 1000,
      publishPerHour: 10,
      publishPerDay: 100,
    };
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    return buildPinterestOAuthUrl(state, redirectUri);
  }

  getPostUrl(postId: string): string {
    return `https://www.pinterest.com/pin/${postId}/`;
  }

  getProfileUrl(username: string): string {
    return `https://www.pinterest.com/${username}/`;
  }

  adaptContent(rawContent: RawContent, brand: BrandContext): AdaptedContent {
    const constraints = this.getContentConstraints();
    let caption = rawContent.caption;
    caption = this.filterProhibitedWords(caption, brand.prohibitedWords);

    // Pinterest: hashtags at end of description, keyword-rich
    const tags = this.dedupeHashtags([
      ...(rawContent.hashtags || []),
      ...brand.preferredHashtags,
    ]).slice(0, constraints.maxHashtags);

    const final = this.buildFinalCaption(caption, tags, constraints.maxCaptionLength);

    return {
      caption: final.caption,
      media: rawContent.mediaAssets.slice(0, 1),
      hashtags: tags,
      mentions: [],
      metadata: { tone: brand.tone, brandName: brand.brandName },
    };
  }

  // ── auth ────────────────────────────────────────────────────────────────────

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const clientId = process.env.PINTEREST_CLIENT_ID ?? '';
    const clientSecret = process.env.PINTEREST_CLIENT_SECRET ?? '';
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenRes = await fetch(PINTEREST_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    await assertOk(tokenRes);

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
    };

    // Fetch the authenticated user's profile info.
    const userRes = await fetch(`${PINTEREST_API_URL}/user_account`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    await assertOk(userRes);

    const userData = (await userRes.json()) as {
      username?: string;
      profile_image?: string;
      id?: string;
    };

    const expiresInSeconds = tokenData.expires_in ?? 2592000; // 30 days default
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
      platformUserId: userData.id ?? userData.username ?? '',
      platformUsername: userData.username ?? '',
      platformAvatarUrl: userData.profile_image,
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const clientId = process.env.PINTEREST_CLIENT_ID ?? '';
    const clientSecret = process.env.PINTEREST_CLIENT_SECRET ?? '';
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenRes = await fetch(PINTEREST_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    await assertOk(tokenRes);

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
    };

    // Re-fetch user info with the new token.
    const userRes = await fetch(`${PINTEREST_API_URL}/user_account`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    await assertOk(userRes);

    const userData = (await userRes.json()) as {
      username?: string;
      profile_image?: string;
      id?: string;
    };

    const expiresInSeconds = tokenData.expires_in ?? 2592000;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? refreshToken,
      expiresAt,
      scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
      platformUserId: userData.id ?? userData.username ?? '',
      platformUsername: userData.username ?? '',
      platformAvatarUrl: userData.profile_image,
    };
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const res = await fetch(`${PINTEREST_API_URL}/user_account`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── publishing ──────────────────────────────────────────────────────────────

  async publish(content: AdaptedContent, credentials: Credentials): Promise<PublishResult> {
    const { accessToken } = credentials;

    // Get user's boards and use the first one.
    const boardsRes = await fetch(`${PINTEREST_API_URL}/boards`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    await assertOk(boardsRes);

    const boardsData = (await boardsRes.json()) as {
      items: Array<{ id: string; name: string }>;
    };
    const boardId = boardsData.items[0]?.id ?? '';

    const firstMedia = content.media[0];
    const isVideo = firstMedia?.type === 'video';

    let mediaSource: Record<string, string>;
    if (isVideo) {
      // For video, use image_url with the video URL as fallback
      mediaSource = {
        source_type: 'image_url',
        url: firstMedia?.url ?? '',
      };
    } else {
      mediaSource = {
        source_type: 'image_url',
        url: firstMedia?.url ?? '',
      };
    }

    const pinBody = {
      board_id: boardId,
      title: content.caption.slice(0, 100),
      description: content.caption.slice(0, 500),
      media_source: mediaSource,
    };

    const pinRes = await fetch(`${PINTEREST_API_URL}/pins`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pinBody),
    });
    await assertOk(pinRes);

    const pinData = (await pinRes.json()) as { id: string; link?: string };

    return {
      success: true,
      platformPostId: pinData.id,
      platformUrl: this.getPostUrl(pinData.id),
      publishedAt: new Date(),
    };
  }

  // ── analytics ───────────────────────────────────────────────────────────────

  async fetchPostAnalytics(postId: string, credentials: Credentials): Promise<PostAnalytics> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const formatDate = (d: Date): string => d.toISOString().split('T')[0];
    const startDate = formatDate(sevenDaysAgo);
    const endDate = formatDate(now);

    const metricTypes = 'IMPRESSION,OUTBOUND_CLICK,PIN_CLICK,SAVE';
    const url = `${PINTEREST_API_URL}/pins/${postId}/analytics?start_date=${startDate}&end_date=${endDate}&metric_types=${metricTypes}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    await assertOk(res);

    const data = (await res.json()) as {
      all?: {
        lifetime_metrics?: Record<string, number>;
        daily_metrics?: Array<Record<string, number>>;
      };
    };

    const lifetimeMetrics = data.all?.lifetime_metrics ?? {};

    const impressions = lifetimeMetrics['IMPRESSION'] ?? 0;
    const outboundClicks = lifetimeMetrics['OUTBOUND_CLICK'] ?? 0;
    const pinClicks = lifetimeMetrics['PIN_CLICK'] ?? 0;
    const saves = lifetimeMetrics['SAVE'] ?? 0;
    const clicks = outboundClicks || pinClicks;
    const engagementRate = (clicks + saves) / (impressions || 1);

    return {
      platformPostId: postId,
      impressions,
      reach: impressions,
      engagement: clicks + saves,
      likes: 0,
      comments: 0,
      shares: 0,
      saves,
      clicks,
      engagementRate,
      fetchedAt: new Date(),
    };
  }

  // ── engagement ──────────────────────────────────────────────────────────────

  fetchComments(_postId: string, _credentials: Credentials): Promise<Comment[]> {
    throw new NotImplementedError(this.platformName, 'fetchComments');
  }

  replyToComment(_commentId: string, _text: string, _credentials: Credentials): Promise<ReplyResult> {
    throw new NotImplementedError(this.platformName, 'replyToComment');
  }
}
