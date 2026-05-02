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
import { buildTikTokOAuthUrl, TIKTOK_TOKEN_URL, TIKTOK_API_URL } from './tiktok.auth';

// ─── shared helper ────────────────────────────────────────────────────────────

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    let message = `TikTok API error ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; error?: { message?: string } };
      message = body.message ?? body.error?.message ?? message;
    } catch {
      // ignore JSON parse errors — keep the default message
    }
    throw new Error(message);
  }
}

// ─── plugin ───────────────────────────────────────────────────────────────────

export class TiktokPlugin extends BasePlatformPlugin {
  readonly platformName = 'tiktok';
  readonly displayName = 'TikTok';
  readonly version = '1.0.0';
  readonly supportedFeatures: PlatformFeatures = {
    publishing: true,
    scheduling: false,
    analytics: true,
    engagement: true,
    dms: false,
    stories: false,
    reels: true,
    carousels: false,
    videos: true,
    webhooks: false,
  };

  getContentConstraints(): ContentConstraints {
    return {
      maxCaptionLength: 2200,
      maxHashtags: 30,
      maxMentions: 30,
      supportedMediaTypes: ['video'],
      maxVideoDurationSec: 600,
      maxFileSizeMb: 4096,
    };
  }

  getRateLimitInfo(): RateLimitConfig {
    return {
      requestsPerHour: 200,
      requestsPerDay: 2000,
      publishPerHour: 10,
      publishPerDay: 50,
    };
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    return buildTikTokOAuthUrl(state, redirectUri);
  }

  getPostUrl(postId: string): string {
    return `https://www.tiktok.com/@/video/${postId}`;
  }

  getProfileUrl(username: string): string {
    return `https://www.tiktok.com/@${username}`;
  }

  adaptContent(rawContent: RawContent, brand: BrandContext): AdaptedContent {
    const constraints = this.getContentConstraints();
    let caption = rawContent.caption;
    caption = this.filterProhibitedWords(caption, brand.prohibitedWords);

    // TikTok: hashtags inline, trend-focused
    const tags = this.dedupeHashtags([
      ...(rawContent.hashtags || []),
      ...brand.preferredHashtags,
    ]).slice(0, constraints.maxHashtags);

    const final = this.buildFinalCaption(caption, tags, constraints.maxCaptionLength);

    return {
      caption: final.caption,
      media: rawContent.mediaAssets.slice(0, 1), // TikTok: one video per post
      hashtags: tags,
      mentions: this.extractMentions(caption),
      metadata: { tone: brand.tone, brandName: brand.brandName },
    };
  }

  // ── auth ────────────────────────────────────────────────────────────────────

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const clientKey = process.env.TIKTOK_CLIENT_KEY || '';
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';

    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    await assertOk(tokenRes);

    const tokenData = (await tokenRes.json()) as {
      data: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        open_id: string;
        scope: string;
      };
      error: { code: string; message: string };
    };

    if (tokenData.error?.code !== 'ok') {
      throw new Error(`TikTok token exchange failed: ${tokenData.error?.message ?? 'unknown error'}`);
    }

    const { access_token, refresh_token, expires_in, open_id, scope } = tokenData.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt,
      scopes: scope ? scope.split(',') : [],
      platformUserId: open_id,
      platformUsername: open_id,
      // open_id stored here for callers that need the raw TikTok user identifier
      platformDisplayName: open_id,
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const clientKey = process.env.TIKTOK_CLIENT_KEY || '';
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_key: clientKey,
      client_secret: clientSecret,
    });

    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    await assertOk(tokenRes);

    const tokenData = (await tokenRes.json()) as {
      data: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        open_id: string;
        scope: string;
      };
      error: { code: string; message: string };
    };

    if (tokenData.error?.code !== 'ok') {
      throw new Error(`TikTok token refresh failed: ${tokenData.error?.message ?? 'unknown error'}`);
    }

    const { access_token, refresh_token: newRefresh, expires_in, open_id, scope } = tokenData.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    return {
      accessToken: access_token,
      refreshToken: newRefresh ?? refreshToken,
      expiresAt,
      scopes: scope ? scope.split(',') : [],
      platformUserId: open_id,
      platformUsername: open_id,
    };
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const res = await fetch(`${TIKTOK_API_URL}/user/info/?fields=open_id`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { error?: { code?: string } };
      return data.error?.code === 'ok';
    } catch {
      return false;
    }
  }

  // ── publishing ──────────────────────────────────────────────────────────────

  async publish(content: AdaptedContent, credentials: Credentials): Promise<PublishResult> {
    const { accessToken } = credentials;

    if (!content.media[0]?.url) {
      throw new Error('TikTok publish requires a video URL in content.media[0].url');
    }

    const caption = content.caption.slice(0, 150);

    // Step 1: Initiate video upload
    const initRes = await fetch(`${TIKTOK_API_URL}/post/publish/video/init/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_info: {
          title: caption,
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: content.media[0].url,
        },
      }),
    });
    await assertOk(initRes);

    const initData = (await initRes.json()) as {
      data: { publish_id: string };
      error: { code: string; message: string };
    };

    if (initData.error?.code !== 'ok') {
      throw new Error(`TikTok publish init failed: ${initData.error?.message ?? 'unknown error'}`);
    }

    const { publish_id } = initData.data;

    // Step 2: Poll for publish status
    const maxAttempts = 10;
    const delayMs = 3000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));

      const statusRes = await fetch(`${TIKTOK_API_URL}/post/publish/status/fetch/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publish_id }),
      });
      await assertOk(statusRes);

      const statusData = (await statusRes.json()) as {
        data: { status: string };
        error: { code: string; message: string };
      };

      const status = statusData.data?.status;

      if (status === 'PUBLISH_COMPLETE') {
        return {
          success: true,
          platformPostId: publish_id,
          platformUrl: 'https://www.tiktok.com/',
          publishedAt: new Date(),
        };
      }

      if (status === 'FAILED') {
        throw new Error(`TikTok publish failed for publish_id: ${publish_id}`);
      }
    }

    throw new Error(`TikTok publish timed out after ${maxAttempts} polling attempts for publish_id: ${publish_id}`);
  }

  // ── analytics ───────────────────────────────────────────────────────────────

  async fetchPostAnalytics(postId: string, credentials: Credentials): Promise<PostAnalytics> {
    const res = await fetch(`${TIKTOK_API_URL}/research/video/query/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filters: { video_ids: [postId] },
        fields: ['like_count', 'comment_count', 'share_count', 'view_count', 'play_count'],
      }),
    });
    await assertOk(res);

    const data = (await res.json()) as {
      data: {
        videos: Array<{
          like_count: number;
          comment_count: number;
          share_count: number;
          view_count: number;
          play_count: number;
        }>;
      };
    };

    const video = data.data?.videos?.[0] ?? {
      like_count: 0,
      comment_count: 0,
      share_count: 0,
      view_count: 0,
      play_count: 0,
    };

    const impressions = video.view_count ?? video.play_count ?? 0;
    const likes = video.like_count ?? 0;
    const comments = video.comment_count ?? 0;
    const shares = video.share_count ?? 0;
    const engagement = likes + comments + shares;
    const engagementRate = engagement / (impressions || 1);

    return {
      platformPostId: postId,
      impressions,
      reach: impressions,
      engagement,
      likes,
      comments,
      shares,
      saves: 0,
      clicks: 0,
      engagementRate,
      fetchedAt: new Date(),
    };
  }

  // ── engagement ──────────────────────────────────────────────────────────────

  async fetchComments(postId: string, credentials: Credentials): Promise<Comment[]> {
    const res = await fetch(
      `${TIKTOK_API_URL}/video/comment/list/?video_id=${postId}&max_count=20`,
      {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      },
    );
    await assertOk(res);

    const data = (await res.json()) as {
      data: {
        comments: Array<{
          cid: string;
          text: string;
          username: string;
          uid: string;
          create_time: number;
          digg_count: number;
        }>;
      };
    };

    const comments = data.data?.comments ?? [];

    return comments.map((comment) => ({
      id: comment.cid,
      authorId: comment.uid,
      authorUsername: comment.username,
      text: comment.text,
      createdAt: new Date(comment.create_time * 1000),
      likes: comment.digg_count,
      isReply: false,
    }));
  }

  async replyToComment(commentId: string, text: string, credentials: Credentials): Promise<ReplyResult> {
    const res = await fetch(`${TIKTOK_API_URL}/video/comment/reply/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id: credentials.platformUserId,
        comment_id: commentId,
        text,
      }),
    });
    await assertOk(res);

    const data = (await res.json()) as { data: { comment_id: string } };

    return {
      replyId: data.data.comment_id,
      publishedAt: new Date(),
    };
  }
}
