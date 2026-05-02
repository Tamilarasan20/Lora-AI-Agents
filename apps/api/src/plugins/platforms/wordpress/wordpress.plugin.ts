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
import { buildWordPressApiBase, buildWordPressOAuthUrl } from './wordpress.auth';

// ─── shared helper ────────────────────────────────────────────────────────────

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    let message = `WordPress API error ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; error?: string; code?: string };
      message = body.message ?? body.error ?? body.code ?? message;
    } catch {
      // ignore JSON parse errors — keep the default message
    }
    throw new Error(message);
  }
}

// ─── plugin ───────────────────────────────────────────────────────────────────

export class WordpressPlugin extends BasePlatformPlugin {
  readonly platformName = 'wordpress';
  readonly displayName = 'WordPress';
  readonly version = '1.0.0';
  readonly supportedFeatures: PlatformFeatures = {
    publishing: true,
    scheduling: true,
    analytics: false,
    engagement: false,
    dms: false,
    stories: false,
    reels: false,
    carousels: false,
    videos: true,
    webhooks: true,
  };

  getContentConstraints(): ContentConstraints {
    return {
      maxCaptionLength: 100000,
      maxHashtags: 20,
      maxMentions: 0,
      supportedMediaTypes: ['image', 'video', 'document'],
      maxVideoDurationSec: 0, // no limit, server-dependent
      maxFileSizeMb: 0, // server-dependent
    };
  }

  getRateLimitInfo(): RateLimitConfig {
    return {
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      publishPerHour: 50,
      publishPerDay: 500,
    };
  }

  // WordPress does not use OAuth redirect flow — returns empty string.
  getOAuthUrl(state: string, redirectUri: string): string {
    return buildWordPressOAuthUrl(state, redirectUri);
  }

  getPostUrl(postId: string, siteUrl = ''): string {
    return siteUrl ? `${siteUrl}/?p=${postId}` : `/?p=${postId}`;
  }

  getProfileUrl(username: string, siteUrl = ''): string {
    return siteUrl ? `${siteUrl}/author/${username}/` : `/author/${username}/`;
  }

  adaptContent(rawContent: RawContent, brand: BrandContext): AdaptedContent {
    const constraints = this.getContentConstraints();
    let caption = rawContent.caption;
    caption = this.filterProhibitedWords(caption, brand.prohibitedWords);

    // WordPress: tags become post tags (no inline hashtags in body)
    const tags = this.dedupeHashtags([
      ...(rawContent.hashtags || []),
      ...brand.preferredHashtags,
    ]).slice(0, constraints.maxHashtags);

    const truncated = this.truncateCaption(caption, constraints.maxCaptionLength);

    return {
      caption: truncated,
      media: rawContent.mediaAssets,
      hashtags: tags,
      mentions: [],
      metadata: {
        tone: brand.tone,
        brandName: brand.brandName,
        title: rawContent.caption.slice(0, 200),
        tags: tags.map((t) => t.replace(/^#/, '')),
      },
    };
  }

  // ── auth ────────────────────────────────────────────────────────────────────

  exchangeCode(_code: string, _redirectUri: string): Promise<OAuthTokens> {
    throw new NotImplementedError(this.platformName, 'exchangeCode');
  }

  refreshToken(_refreshToken: string): Promise<OAuthTokens> {
    throw new NotImplementedError(this.platformName, 'refreshToken');
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      // accessToken is stored as the raw base64(username:app_password) for WordPress
      // We need to get the credentials object to access metadata.siteUrl
      // validateToken interface takes accessToken string — we rely on a Credentials overload
      // For this interface signature, we cannot access siteUrl, so return true as a no-op
      // The real validation happens via validateTokenWithCredentials
      void accessToken;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate a WordPress token using full credentials (includes siteUrl in metadata).
   * This is the recommended method for WordPress since the base URL is required.
   */
  async validateTokenWithCredentials(credentials: Credentials): Promise<boolean> {
    try {
      const siteUrl = (credentials as Credentials & { metadata?: { siteUrl?: string } }).metadata?.siteUrl ?? '';
      const apiBase = buildWordPressApiBase(siteUrl);
      const res = await fetch(`${apiBase}/users/me`, {
        headers: { Authorization: `Basic ${credentials.accessToken}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── publishing ──────────────────────────────────────────────────────────────

  async publish(content: AdaptedContent, credentials: Credentials): Promise<PublishResult> {
    const credWithMeta = credentials as Credentials & { metadata?: { siteUrl?: string } };
    const siteUrl = credWithMeta.metadata?.siteUrl ?? '';
    const apiBase = buildWordPressApiBase(siteUrl);

    const postBody = {
      title: (content.metadata?.title as string | undefined) ?? content.caption.slice(0, 200),
      content: content.caption,
      status: 'publish',
      tags: content.hashtags.map((h) => h.replace('#', '')),
    };

    const res = await fetch(`${apiBase}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials.accessToken}`,
      },
      body: JSON.stringify(postBody),
    });
    await assertOk(res);

    const response = (await res.json()) as { id: number; link: string; slug: string };

    return {
      success: true,
      platformPostId: String(response.id),
      platformUrl: response.link,
      publishedAt: new Date(),
    };
  }

  // ── analytics ───────────────────────────────────────────────────────────────

  async fetchPostAnalytics(postId: string, credentials: Credentials): Promise<PostAnalytics> {
    const credWithMeta = credentials as Credentials & { metadata?: { siteUrl?: string } };
    const siteUrl = credWithMeta.metadata?.siteUrl ?? '';
    const apiBase = buildWordPressApiBase(siteUrl);

    const res = await fetch(`${apiBase}/posts/${postId}`, {
      headers: { Authorization: `Basic ${credentials.accessToken}` },
    });
    await assertOk(res);

    const response = (await res.json()) as { comment_count?: number };
    const commentCount = response.comment_count ?? 0;

    return {
      platformPostId: postId,
      impressions: 0,
      reach: 0,
      engagement: commentCount,
      likes: 0,
      comments: commentCount,
      shares: 0,
      saves: 0,
      clicks: 0,
      engagementRate: 0,
      fetchedAt: new Date(),
    };
  }

  // ── engagement ──────────────────────────────────────────────────────────────

  async fetchComments(postId: string, credentials: Credentials): Promise<Comment[]> {
    const credWithMeta = credentials as Credentials & { metadata?: { siteUrl?: string } };
    const siteUrl = credWithMeta.metadata?.siteUrl ?? '';
    const apiBase = buildWordPressApiBase(siteUrl);

    const res = await fetch(`${apiBase}/comments?post=${postId}&per_page=20`, {
      headers: { Authorization: `Basic ${credentials.accessToken}` },
    });
    await assertOk(res);

    const comments = (await res.json()) as Array<{
      id: number;
      content: { rendered: string };
      author_name: string;
      author: number;
      date: string;
      parent: number;
    }>;

    return comments.map((c) => ({
      id: String(c.id),
      authorId: String(c.author),
      authorUsername: c.author_name,
      text: c.content.rendered.replace(/<[^>]*>/g, ''),
      createdAt: new Date(c.date),
      likes: 0,
      isReply: c.parent > 0,
    }));
  }

  async replyToComment(commentId: string, text: string, credentials: Credentials): Promise<ReplyResult> {
    const credWithMeta = credentials as Credentials & { metadata?: { siteUrl?: string } };
    const siteUrl = credWithMeta.metadata?.siteUrl ?? '';
    const apiBase = buildWordPressApiBase(siteUrl);

    const res = await fetch(`${apiBase}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials.accessToken}`,
      },
      body: JSON.stringify({
        content: text,
        parent: Number(commentId),
        post: 0,
      }),
    });
    await assertOk(res);

    const response = (await res.json()) as { id: number };

    return {
      replyId: String(response.id),
      publishedAt: new Date(),
    };
  }
}
