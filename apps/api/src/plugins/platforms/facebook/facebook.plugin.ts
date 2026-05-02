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
import { buildFacebookOAuthUrl, FACEBOOK_TOKEN_URL, FACEBOOK_API_URL } from './facebook.auth';

// ─── shared helper ────────────────────────────────────────────────────────────

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    let message = `Facebook API error ${res.status}`;
    try {
      const body = (await res.json()) as {
        error?: { message?: string; type?: string; code?: number };
      };
      if (body.error?.message) {
        message = body.error.message;
      }
    } catch {
      // ignore JSON parse errors — keep the default message
    }
    throw new Error(message);
  }
}

// ─── plugin ───────────────────────────────────────────────────────────────────

export class FacebookPlugin extends BasePlatformPlugin {
  readonly platformName = 'facebook';
  readonly displayName = 'Facebook';
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

  // ── identity ────────────────────────────────────────────────────────────────

  getContentConstraints(): ContentConstraints {
    return {
      maxCaptionLength: 63206,
      maxHashtags: 30,
      maxMentions: 50,
      supportedMediaTypes: ['image', 'video'],
      maxVideoDurationSec: 14400, // 4 hours
      maxFileSizeMb: 10240,
    };
  }

  getRateLimitInfo(): RateLimitConfig {
    return {
      requestsPerHour: 200,
      requestsPerDay: 4800,
      publishPerHour: 25,
      publishPerDay: 200,
    };
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    return buildFacebookOAuthUrl(state, redirectUri);
  }

  getPostUrl(postId: string): string {
    return `https://www.facebook.com/${postId}`;
  }

  getProfileUrl(username: string): string {
    return `https://www.facebook.com/${username}`;
  }

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
      metadata: { tone: brand.tone, brandName: brand.brandName },
    };
  }

  // ── auth ────────────────────────────────────────────────────────────────────

  /**
   * Exchange an authorization code for a long-lived Page access token.
   *
   * Flow:
   *  1. Short-lived user token from the code.
   *  2. Long-lived user token (60-day) via fb_exchange_token.
   *  3. List of managed Pages — pick the first one as the primary connection.
   */
  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const clientId = process.env.FACEBOOK_CLIENT_ID ?? '';
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET ?? '';

    // Step 1: short-lived user token.
    const shortLivedParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });

    const shortRes = await fetch(`${FACEBOOK_TOKEN_URL}?${shortLivedParams.toString()}`);
    await assertOk(shortRes);

    const shortData = (await shortRes.json()) as {
      access_token: string;
      token_type: string;
      expires_in?: number;
    };
    const shortLivedToken = shortData.access_token;

    // Step 2: exchange for a long-lived user token (60 days).
    const longLivedParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: shortLivedToken,
    });

    const longRes = await fetch(
      `${FACEBOOK_API_URL}/oauth/access_token?${longLivedParams.toString()}`,
    );
    await assertOk(longRes);

    const longData = (await longRes.json()) as {
      access_token: string;
      token_type: string;
      expires_in?: number;
    };
    const longLivedUserToken = longData.access_token;
    const expiresInSeconds = longData.expires_in ?? 5184000; // 60 days

    // Step 3: list Pages the user manages.
    const pagesRes = await fetch(
      `${FACEBOOK_API_URL}/me/accounts?access_token=${longLivedUserToken}&fields=id,name,access_token,category`,
    );
    await assertOk(pagesRes);

    const pagesData = (await pagesRes.json()) as {
      data: Array<{
        id: string;
        name: string;
        access_token: string;
        category?: string;
      }>;
    };

    // Use the first page as the primary connection.
    const page = pagesData.data[0];
    if (!page) {
      throw new Error(
        'Facebook account has no managed Pages. At least one Page is required to publish content.',
      );
    }

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return {
      // Store the Page access token as the primary token — all publish/read
      // operations act on behalf of the Page, not the individual user.
      accessToken: page.access_token,
      // Use the long-lived user token as the "refresh token" so we can
      // re-exchange it later via refreshToken().
      refreshToken: longLivedUserToken,
      expiresAt,
      scopes: [], // Facebook doesn't return granted scopes in this response
      platformUserId: page.id,
      platformUsername: page.name,
      platformDisplayName: page.name,
    };
  }

  /**
   * Re-exchange a long-lived token.
   * Facebook Page tokens are technically non-expiring, but we re-exchange the
   * stored user token to get a fresh 60-day window and a fresh Page token.
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const clientId = process.env.FACEBOOK_CLIENT_ID ?? '';
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET ?? '';

    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: refreshToken,
    });

    const res = await fetch(`${FACEBOOK_API_URL}/oauth/access_token?${params.toString()}`);
    await assertOk(res);

    const data = (await res.json()) as {
      access_token: string;
      token_type: string;
      expires_in?: number;
    };

    const newUserToken = data.access_token;
    const expiresInSeconds = data.expires_in ?? 5184000;

    // Re-fetch Page token.
    const pagesRes = await fetch(
      `${FACEBOOK_API_URL}/me/accounts?access_token=${newUserToken}&fields=id,name,access_token`,
    );
    await assertOk(pagesRes);

    const pagesData = (await pagesRes.json()) as {
      data: Array<{ id: string; name: string; access_token: string }>;
    };

    const page = pagesData.data[0];
    if (!page) {
      throw new Error('No managed Facebook Pages found during token refresh.');
    }

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return {
      accessToken: page.access_token,
      refreshToken: newUserToken,
      expiresAt,
      scopes: [],
      platformUserId: page.id,
      platformUsername: page.name,
      platformDisplayName: page.name,
    };
  }

  /** Probe the Graph API /me endpoint to verify the token is still valid. */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const res = await fetch(`${FACEBOOK_API_URL}/me?access_token=${accessToken}`);
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── publishing ──────────────────────────────────────────────────────────────

  /**
   * Publish a text post or a photo post to the Facebook Page feed.
   * - If content.media contains image(s) → POST to /{pageId}/photos (single photo).
   * - Otherwise → POST to /{pageId}/feed (text post).
   */
  async publish(content: AdaptedContent, credentials: Credentials): Promise<PublishResult> {
    const { accessToken, platformUserId: pageId } = credentials;

    if (!pageId) {
      throw new Error('FacebookPlugin.publish: credentials.platformUserId (Page ID) is required.');
    }

    const message = content.caption;
    const imageAsset = content.media.find((m) => m.type === 'image');

    let postId: string;

    if (imageAsset) {
      // Photo post — Facebook accepts an image URL directly.
      const body: Record<string, string> = {
        url: imageAsset.url,
        caption: message,
        access_token: accessToken,
      };

      const res = await fetch(`${FACEBOOK_API_URL}/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await assertOk(res);

      const data = (await res.json()) as { id: string; post_id?: string };
      // post_id is the Page post reference; id is the photo object ID.
      postId = data.post_id ?? data.id;
    } else {
      // Text / link post.
      const body: Record<string, string> = {
        message,
        access_token: accessToken,
      };

      // Attach a link if any media asset has a URL (e.g. a shared link).
      const linkAsset = content.media.find((m) => m.type === 'document');
      if (linkAsset) {
        body.link = linkAsset.url;
      }

      const res = await fetch(`${FACEBOOK_API_URL}/${pageId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await assertOk(res);

      const data = (await res.json()) as { id: string };
      postId = data.id;
    }

    return {
      success: true,
      platformPostId: postId,
      platformUrl: this.getPostUrl(postId),
      publishedAt: new Date(),
    };
  }

  // ── analytics ───────────────────────────────────────────────────────────────

  async fetchPostAnalytics(postId: string, credentials: Credentials): Promise<PostAnalytics> {
    const metrics = [
      'post_impressions',
      'post_impressions_unique',
      'post_reach',
      'post_engaged_users',
      'post_clicks',
    ].join(',');

    const res = await fetch(
      `${FACEBOOK_API_URL}/${postId}/insights?metric=${metrics}&access_token=${credentials.accessToken}`,
    );
    await assertOk(res);

    const data = (await res.json()) as {
      data: Array<{
        name: string;
        values: Array<{ value: number }>;
      }>;
    };

    const get = (name: string): number => {
      const item = data.data.find((d) => d.name === name);
      return item?.values?.[0]?.value ?? 0;
    };

    // Also fetch like/comment/share counts from the post object.
    const postRes = await fetch(
      `${FACEBOOK_API_URL}/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${credentials.accessToken}`,
    );

    let likes = 0;
    let comments = 0;
    let shares = 0;

    if (postRes.ok) {
      const postData = (await postRes.json()) as {
        likes?: { summary?: { total_count: number } };
        comments?: { summary?: { total_count: number } };
        shares?: { count: number };
      };
      likes = postData.likes?.summary?.total_count ?? 0;
      comments = postData.comments?.summary?.total_count ?? 0;
      shares = postData.shares?.count ?? 0;
    }

    const impressions = get('post_impressions');
    const reach = get('post_reach') || get('post_impressions_unique');
    const engagedUsers = get('post_engaged_users');
    const clicks = get('post_clicks');
    const engagement = likes + comments + shares + engagedUsers;
    const engagementRate = engagement / (reach || 1);

    return {
      platformPostId: postId,
      impressions,
      reach,
      engagement,
      likes,
      comments,
      shares,
      saves: 0, // Facebook doesn't expose saves for Pages
      clicks,
      engagementRate,
      fetchedAt: new Date(),
    };
  }

  // ── engagement ──────────────────────────────────────────────────────────────

  async fetchComments(postId: string, credentials: Credentials): Promise<Comment[]> {
    const res = await fetch(
      `${FACEBOOK_API_URL}/${postId}/comments?fields=id,message,from,created_time,like_count,parent&access_token=${credentials.accessToken}`,
    );
    await assertOk(res);

    const data = (await res.json()) as {
      data: Array<{
        id: string;
        message: string;
        from?: { id: string; name: string };
        created_time: string;
        like_count?: number;
        parent?: { id: string };
      }>;
    };

    return data.data.map((item) => ({
      id: item.id,
      authorId: item.from?.id ?? '',
      authorUsername: item.from?.name ?? '',
      text: item.message,
      createdAt: new Date(item.created_time),
      likes: item.like_count ?? 0,
      isReply: !!item.parent,
      parentId: item.parent?.id ?? postId,
    } satisfies Comment));
  }

  /** Reply to a comment on a Facebook Page post. */
  async replyToComment(
    commentId: string,
    text: string,
    credentials: Credentials,
  ): Promise<ReplyResult> {
    const res = await fetch(`${FACEBOOK_API_URL}/${commentId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        access_token: credentials.accessToken,
      }),
    });
    await assertOk(res);

    const data = (await res.json()) as { id: string };
    return {
      replyId: data.id,
      publishedAt: new Date(),
    };
  }
}
