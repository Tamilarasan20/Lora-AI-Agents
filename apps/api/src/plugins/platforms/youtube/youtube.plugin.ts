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
import { buildYouTubeOAuthUrl, YOUTUBE_TOKEN_URL, YOUTUBE_API_URL } from './youtube.auth';

// ─── shared helper ────────────────────────────────────────────────────────────

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    let message = `YouTube API error ${res.status}`;
    try {
      const body = (await res.json()) as {
        error?: { message?: string; errors?: Array<{ message?: string }> };
      };
      message =
        body.error?.message ??
        body.error?.errors?.[0]?.message ??
        message;
    } catch {
      // ignore JSON parse errors — keep the default message
    }
    throw new Error(message);
  }
}

// ─── plugin ───────────────────────────────────────────────────────────────────

export class YoutubePlugin extends BasePlatformPlugin {
  readonly platformName = 'youtube';
  readonly displayName = 'YouTube';
  readonly version = '1.0.0';
  readonly supportedFeatures: PlatformFeatures = {
    publishing: true,
    scheduling: true,
    analytics: true,
    engagement: true,
    dms: false,
    stories: false,
    reels: true,
    carousels: false,
    videos: true,
    webhooks: true,
  };

  getContentConstraints(): ContentConstraints {
    return {
      maxCaptionLength: 5000,
      maxHashtags: 15,
      maxMentions: 0,
      supportedMediaTypes: ['video'],
      maxVideoDurationSec: 43200, // 12 hours for verified accounts
      maxFileSizeMb: 256 * 1024, // 256 GB
    };
  }

  getRateLimitInfo(): RateLimitConfig {
    return {
      requestsPerHour: 10000,
      requestsPerDay: 1000000,
      publishPerHour: 6,
      publishPerDay: 100,
    };
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    return buildYouTubeOAuthUrl(state, redirectUri);
  }

  getPostUrl(postId: string): string {
    return `https://www.youtube.com/watch?v=${postId}`;
  }

  getProfileUrl(username: string): string {
    return `https://www.youtube.com/@${username}`;
  }

  adaptContent(rawContent: RawContent, brand: BrandContext): AdaptedContent {
    const constraints = this.getContentConstraints();
    let caption = rawContent.caption;
    caption = this.filterProhibitedWords(caption, brand.prohibitedWords);

    // YouTube: hashtags in description near the end, max 15 (>15 ignored by algo)
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
      metadata: {
        tone: brand.tone,
        brandName: brand.brandName,
        title: rawContent.caption.slice(0, 100),
      },
    };
  }

  // ── auth ────────────────────────────────────────────────────────────────────

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const clientId = process.env.YOUTUBE_CLIENT_ID || '';
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || '';

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch(YOUTUBE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    await assertOk(tokenRes);

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope?: string;
    };

    // Fetch user/channel info
    const userRes = await fetch(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenData.access_token}`,
    );
    await assertOk(userRes);

    const userInfo = (await userRes.json()) as {
      id: string;
      name?: string;
      email?: string;
      picture?: string;
    };

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
      platformUserId: userInfo.id,
      platformUsername: userInfo.email ?? userInfo.id,
      platformDisplayName: userInfo.name,
      platformAvatarUrl: userInfo.picture,
      // channel_id == userInfo.id — surfaced via platformUserId for callers
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const clientId = process.env.YOUTUBE_CLIENT_ID || '';
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || '';

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenRes = await fetch(YOUTUBE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    await assertOk(tokenRes);

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
      scope?: string;
    };

    // Re-fetch user info with the new token
    const userRes = await fetch(
      `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenData.access_token}`,
    );
    await assertOk(userRes);

    const userInfo = (await userRes.json()) as {
      id: string;
      name?: string;
      email?: string;
      picture?: string;
    };

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? refreshToken,
      expiresAt,
      scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
      platformUserId: userInfo.id,
      platformUsername: userInfo.email ?? userInfo.id,
      platformDisplayName: userInfo.name,
      platformAvatarUrl: userInfo.picture,
    };
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const res = await fetch(`${YOUTUBE_API_URL}/channels?part=id&mine=true`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { items?: unknown[] };
      return Array.isArray(data.items) && data.items.length > 0;
    } catch {
      return false;
    }
  }

  // ── publishing ──────────────────────────────────────────────────────────────

  async publish(content: AdaptedContent, credentials: Credentials): Promise<PublishResult> {
    const { accessToken } = credentials;

    if (!content.media[0]?.url) {
      throw new Error('YouTube publish requires a video URL in content.media[0].url');
    }

    // Fetch video bytes from the source URL
    const videoRes = await fetch(content.media[0].url);
    if (!videoRes.ok) {
      throw new Error(`Failed to fetch video from URL: ${content.media[0].url}`);
    }
    const videoBuffer = await videoRes.arrayBuffer();

    const title = (
      (content.metadata.title as string | undefined) ?? content.caption
    ).slice(0, 100);

    const metadata = {
      snippet: {
        title,
        description: content.caption,
        tags: content.hashtags.map((h) => h.replace('#', '')),
      },
      status: {
        privacyStatus: 'public',
      },
    };

    // Multipart upload boundary
    const boundary = `loraloop_boundary_${Date.now()}`;
    const metadataJson = JSON.stringify(metadata);

    // Build multipart body manually as a Buffer
    const encoder = new TextEncoder();
    const preamble = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataJson}\r\n--${boundary}\r\nContent-Type: video/*\r\n\r\n`,
    );
    const epilogue = encoder.encode(`\r\n--${boundary}--`);

    const combinedBuffer = new Uint8Array(
      preamble.byteLength + videoBuffer.byteLength + epilogue.byteLength,
    );
    combinedBuffer.set(preamble, 0);
    combinedBuffer.set(new Uint8Array(videoBuffer), preamble.byteLength);
    combinedBuffer.set(epilogue, preamble.byteLength + videoBuffer.byteLength);

    const uploadRes = await fetch(
      `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': String(combinedBuffer.byteLength),
        },
        body: combinedBuffer,
      },
    );
    await assertOk(uploadRes);

    const uploadData = (await uploadRes.json()) as { id: string };

    return {
      success: true,
      platformPostId: uploadData.id,
      platformUrl: this.getPostUrl(uploadData.id),
      publishedAt: new Date(),
    };
  }

  // ── analytics ───────────────────────────────────────────────────────────────

  async fetchPostAnalytics(postId: string, credentials: Credentials): Promise<PostAnalytics> {
    const res = await fetch(`${YOUTUBE_API_URL}/videos?part=statistics&id=${postId}`, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    await assertOk(res);

    const data = (await res.json()) as {
      items: Array<{
        statistics: {
          viewCount?: string;
          likeCount?: string;
          commentCount?: string;
          favoriteCount?: string;
        };
      }>;
    };

    const stats = data.items?.[0]?.statistics ?? {};
    const impressions = parseInt(stats.viewCount ?? '0', 10);
    const likes = parseInt(stats.likeCount ?? '0', 10);
    const comments = parseInt(stats.commentCount ?? '0', 10);
    const engagement = likes + comments;
    const engagementRate = engagement / (impressions || 1);

    return {
      platformPostId: postId,
      impressions,
      reach: impressions,
      engagement,
      likes,
      comments,
      shares: 0,
      saves: parseInt(stats.favoriteCount ?? '0', 10),
      clicks: 0,
      engagementRate,
      fetchedAt: new Date(),
    };
  }

  // ── engagement ──────────────────────────────────────────────────────────────

  async fetchComments(postId: string, credentials: Credentials): Promise<Comment[]> {
    const res = await fetch(
      `${YOUTUBE_API_URL}/commentThreads?part=snippet&videoId=${postId}&maxResults=20`,
      {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      },
    );
    await assertOk(res);

    const data = (await res.json()) as {
      items: Array<{
        id: string;
        snippet: {
          topLevelComment: {
            snippet: {
              textDisplay: string;
              authorDisplayName: string;
              authorChannelId?: { value: string };
              publishedAt: string;
              likeCount: number;
            };
          };
        };
      }>;
    };

    const items = data.items ?? [];

    return items.map((item) => {
      const snippet = item.snippet.topLevelComment.snippet;
      return {
        id: item.id,
        authorId: snippet.authorChannelId?.value ?? '',
        authorUsername: snippet.authorDisplayName,
        text: snippet.textDisplay,
        createdAt: new Date(snippet.publishedAt),
        likes: snippet.likeCount,
        isReply: false,
      };
    });
  }

  async replyToComment(commentId: string, text: string, credentials: Credentials): Promise<ReplyResult> {
    const res = await fetch(`${YOUTUBE_API_URL}/comments?part=snippet`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          parentId: commentId,
          textOriginal: text,
        },
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
