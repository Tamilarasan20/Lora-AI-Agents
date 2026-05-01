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
} from '../../platform-plugin.interface';
import {
  buildInstagramOAuthUrl,
  INSTAGRAM_TOKEN_URL,
  INSTAGRAM_GRAPH_URL,
  INSTAGRAM_SCOPES,
} from './instagram.auth';

// ─── Internal API response shapes ─────────────────────────────────────────────

interface IGShortTokenResponse {
  access_token: string;
  token_type: string;
}

interface IGLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface IGRefreshTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface IGMeResponse {
  id: string;
  name?: string;
}

interface IGAccountsResponse {
  data: Array<{
    instagram_business_account?: { id: string };
    id: string;
  }>;
}

interface IGMediaContainerResponse {
  id: string;
}

interface IGPublishResponse {
  id: string;
}

interface IGInsightValue {
  value: number;
}

interface IGInsightItem {
  name: string;
  values?: IGInsightValue[];
  value?: number;
}

interface IGInsightsResponse {
  data: IGInsightItem[];
}

interface IGCommentItem {
  id: string;
  text: string;
  username: string;
  timestamp: string;
}

interface IGCommentsResponse {
  data: IGCommentItem[];
}

interface IGReplyResponse {
  id: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function assertOk(res: Response, context: string): Promise<void> {
  if (!res.ok) {
    let message = `Instagram API error (${res.status}) in ${context}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) {
        message = `Instagram API error in ${context}: ${body.error.message}`;
      }
    } catch {
      // ignore JSON parse failure — use the generic message
    }
    throw new Error(message);
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export class InstagramPlugin extends BasePlatformPlugin {
  readonly platformName = 'instagram';
  readonly displayName = 'Instagram';
  readonly version = '1.0.0';
  readonly supportedFeatures: PlatformFeatures = {
    publishing: true,
    scheduling: true,
    analytics: true,
    engagement: true,
    dms: true,
    stories: true,
    reels: true,
    carousels: true,
    videos: true,
    webhooks: true,
  };

  // ─── Content constraints ───────────────────────────────────────────────────

  getContentConstraints(): ContentConstraints {
    return {
      maxCaptionLength: 2200,
      maxHashtags: 30,
      maxMentions: 20,
      supportedMediaTypes: ['image', 'video'],
      maxVideoDurationSec: 90,
      maxFileSizeMb: 100,
      minAspectRatio: 0.8,
      maxAspectRatio: 1.91,
    };
  }

  getRateLimitInfo(): RateLimitConfig {
    return {
      requestsPerHour: 200,
      requestsPerDay: 4800,
      publishPerHour: 25,
      publishPerDay: 100,
    };
  }

  // ─── URLs ──────────────────────────────────────────────────────────────────

  getOAuthUrl(state: string, redirectUri: string): string {
    return buildInstagramOAuthUrl(state, redirectUri);
  }

  getPostUrl(postId: string): string {
    return `https://www.instagram.com/p/${postId}/`;
  }

  getProfileUrl(username: string): string {
    return `https://www.instagram.com/${username}/`;
  }

  // ─── OAuth ─────────────────────────────────────────────────────────────────

  /**
   * Exchanges an authorization code for long-lived OAuthTokens.
   *
   * Steps:
   * 1. Trade the code for a short-lived token via the Meta token endpoint.
   * 2. Upgrade to a long-lived (60-day) token.
   * 3. Resolve the Facebook user ID and then the Instagram Business Account ID.
   */
  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const clientId = process.env.META_CLIENT_ID ?? '';
    const clientSecret = process.env.META_CLIENT_SECRET ?? '';

    // Step 1: short-lived token
    const shortParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    });

    const shortRes = await fetch(INSTAGRAM_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: shortParams.toString(),
    });
    await assertOk(shortRes, 'exchangeCode/short-token');
    const shortData = (await shortRes.json()) as IGShortTokenResponse;
    const shortToken = shortData.access_token;

    // Step 2: long-lived token
    const longRes = await fetch(
      `${INSTAGRAM_GRAPH_URL}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: clientId,
          client_secret: clientSecret,
          fb_exchange_token: shortToken,
        }).toString(),
    );
    await assertOk(longRes, 'exchangeCode/long-token');
    const longData = (await longRes.json()) as IGLongLivedTokenResponse;
    const accessToken = longData.access_token;

    // Step 3: Facebook user ID
    const meRes = await fetch(
      `${INSTAGRAM_GRAPH_URL}/me?fields=id,name&access_token=${accessToken}`,
    );
    await assertOk(meRes, 'exchangeCode/me');
    const meData = (await meRes.json()) as IGMeResponse;
    const fbUserId = meData.id;

    // Step 4: Instagram Business Account ID
    const accountsRes = await fetch(
      `${INSTAGRAM_GRAPH_URL}/${fbUserId}/accounts?fields=instagram_business_account&access_token=${accessToken}`,
    );
    await assertOk(accountsRes, 'exchangeCode/accounts');
    const accountsData = (await accountsRes.json()) as IGAccountsResponse;

    const igAccount = accountsData.data.find(
      (page) => page.instagram_business_account?.id,
    );
    const platformUserId =
      igAccount?.instagram_business_account?.id ?? fbUserId;

    // Fetch the IG username
    let platformUsername = meData.name ?? platformUserId;
    if (igAccount?.instagram_business_account?.id) {
      try {
        const igMeRes = await fetch(
          `${INSTAGRAM_GRAPH_URL}/${platformUserId}?fields=id,username&access_token=${accessToken}`,
        );
        if (igMeRes.ok) {
          const igMe = (await igMeRes.json()) as { id: string; username?: string };
          if (igMe.username) platformUsername = igMe.username;
        }
      } catch {
        // fall through — username stays as FB name
      }
    }

    return {
      accessToken,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      platformUserId,
      platformUsername,
      scopes: INSTAGRAM_SCOPES,
    };
  }

  /**
   * Refreshes a long-lived Instagram token (valid for another 60 days).
   */
  async refreshToken(currentToken: string): Promise<OAuthTokens> {
    const res = await fetch(
      `${INSTAGRAM_GRAPH_URL}/refresh_access_token?` +
        new URLSearchParams({
          grant_type: 'ig_refresh_token',
          access_token: currentToken,
        }).toString(),
    );
    await assertOk(res, 'refreshToken');
    const data = (await res.json()) as IGRefreshTokenResponse;

    // We need the user identity to populate the returned tokens.
    const meRes = await fetch(
      `${INSTAGRAM_GRAPH_URL}/me?fields=id,username&access_token=${data.access_token}`,
    );
    await assertOk(meRes, 'refreshToken/me');
    const me = (await meRes.json()) as { id: string; username?: string };

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      platformUserId: me.id,
      platformUsername: me.username ?? me.id,
      scopes: INSTAGRAM_SCOPES,
    };
  }

  /**
   * Returns true when the token is still valid (Graph API /me succeeds).
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${INSTAGRAM_GRAPH_URL}/me?access_token=${accessToken}`,
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  // ─── Publishing ────────────────────────────────────────────────────────────

  /**
   * Publishes a single image or video (Reels) to Instagram via the two-step
   * Content Publishing API:
   *   1. Create a media container.
   *   2. Publish the container.
   */
  async publish(
    content: AdaptedContent,
    credentials: Credentials,
  ): Promise<PublishResult> {
    const { accessToken, platformUserId } = credentials;
    const igUserId = platformUserId ?? '';

    // Build the caption: text + hashtags
    const hashtagStr = content.hashtags.length
      ? ' ' + content.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
      : '';
    const caption = content.caption + hashtagStr;

    // Determine media type
    const firstMedia = content.media[0];
    const isVideo =
      firstMedia?.type === 'video' ||
      (firstMedia?.mimeType?.startsWith('video') ?? false);

    // Step 1 — create media container
    const containerBody: Record<string, string> = {
      caption,
      access_token: accessToken,
    };

    if (isVideo) {
      containerBody['video_url'] = firstMedia.url;
      containerBody['media_type'] = 'REELS';
    } else {
      containerBody['image_url'] = firstMedia?.url ?? '';
    }

    const containerRes = await fetch(
      `${INSTAGRAM_GRAPH_URL}/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(containerBody),
      },
    );
    await assertOk(containerRes, 'publish/create-container');
    const container = (await containerRes.json()) as IGMediaContainerResponse;

    // Step 2 — publish the container
    const publishRes = await fetch(
      `${INSTAGRAM_GRAPH_URL}/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: container.id,
          access_token: accessToken,
        }),
      },
    );
    await assertOk(publishRes, 'publish/media-publish');
    const result = (await publishRes.json()) as IGPublishResponse;

    return {
      success: true,
      platformPostId: result.id,
      platformUrl: this.getPostUrl(result.id),
      publishedAt: new Date(),
    };
  }

  // ─── Analytics ─────────────────────────────────────────────────────────────

  /**
   * Fetches post-level insights from the Instagram Graph API and maps them to
   * the PostAnalytics shape.
   */
  async fetchPostAnalytics(
    postId: string,
    credentials: Credentials,
  ): Promise<PostAnalytics> {
    const { accessToken } = credentials;

    const res = await fetch(
      `${INSTAGRAM_GRAPH_URL}/${postId}/insights?` +
        new URLSearchParams({
          metric: 'impressions,reach,likes_count,comments_count,shares,saved',
          access_token: accessToken,
        }).toString(),
    );
    await assertOk(res, 'fetchPostAnalytics');
    const data = (await res.json()) as IGInsightsResponse;

    const getValue = (name: string): number => {
      const item = data.data.find((d) => d.name === name);
      if (!item) return 0;
      // Metric can come back as a scalar `value` or as a `values` array
      if (typeof item.value === 'number') return item.value;
      if (Array.isArray(item.values) && item.values.length > 0) {
        return item.values[0]?.value ?? 0;
      }
      return 0;
    };

    const impressions = getValue('impressions');
    const reach = getValue('reach');
    const likes = getValue('likes_count');
    const comments = getValue('comments_count');
    const shares = getValue('shares');
    const saves = getValue('saved');
    const engagementRate = (likes + comments + shares) / (reach || 1);

    return {
      platformPostId: postId,
      impressions,
      reach,
      engagement: likes + comments + shares + saves,
      likes,
      comments,
      shares,
      saves,
      clicks: 0,
      engagementRate,
      fetchedAt: new Date(),
    };
  }

  // ─── Engagement ────────────────────────────────────────────────────────────

  /**
   * Fetches top-level comments on a post.
   */
  async fetchComments(
    postId: string,
    credentials: Credentials,
  ): Promise<Comment[]> {
    const { accessToken } = credentials;

    const res = await fetch(
      `${INSTAGRAM_GRAPH_URL}/${postId}/comments?` +
        new URLSearchParams({
          fields: 'id,text,username,timestamp',
          access_token: accessToken,
        }).toString(),
    );
    await assertOk(res, 'fetchComments');
    const data = (await res.json()) as IGCommentsResponse;

    return data.data.map((item) => ({
      id: item.id,
      text: item.text,
      authorUsername: item.username,
      authorId: item.id, // IG comment IDs double as the commenter reference in basic API
      createdAt: new Date(item.timestamp),
      likes: 0,
      isReply: false,
    }));
  }

  /**
   * Replies to a comment on Instagram.
   */
  async replyToComment(
    commentId: string,
    text: string,
    credentials: Credentials,
  ): Promise<ReplyResult> {
    const { accessToken } = credentials;

    const res = await fetch(
      `${INSTAGRAM_GRAPH_URL}/${commentId}/replies`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          access_token: accessToken,
        }),
      },
    );
    await assertOk(res, 'replyToComment');
    const result = (await res.json()) as IGReplyResponse;

    return {
      replyId: result.id,
      publishedAt: new Date(),
    };
  }

  // ─── Content adaptation ────────────────────────────────────────────────────

  adaptContent(rawContent: RawContent, brand: BrandContext): AdaptedContent {
    const constraints = this.getContentConstraints();

    let caption = rawContent.caption;
    caption = this.filterProhibitedWords(caption, brand.prohibitedWords);

    const tags = this.dedupeHashtags([
      ...(rawContent.hashtags || []),
      ...brand.preferredHashtags,
    ]).slice(0, constraints.maxHashtags);

    const final = this.buildFinalCaption(caption, tags, constraints.maxCaptionLength);

    return {
      caption: final.caption,
      media: rawContent.mediaAssets,
      hashtags: tags,
      mentions: this.extractMentions(caption),
      firstComment: final.firstComment,
      metadata: { tone: brand.tone, brandName: brand.brandName },
    };
  }

  // getOptimalPostingTimes — default from base; refine when Instagram audience data lands.
}
