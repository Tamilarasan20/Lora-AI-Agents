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
import { buildTwitterOAuthUrl, retrieveVerifier, TWITTER_TOKEN_URL, TWITTER_API_URL } from './twitter.auth';

// ─── shared helper ────────────────────────────────────────────────────────────

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    let message = `Twitter API error ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string; error?: string; error_description?: string };
      message = body.detail ?? body.error_description ?? body.error ?? message;
    } catch {
      // ignore JSON parse errors — keep the default message
    }
    throw new Error(message);
  }
}

// ─── plugin ───────────────────────────────────────────────────────────────────

export class TwitterPlugin extends BasePlatformPlugin {
  readonly platformName = 'twitter';
  readonly displayName = 'X (Twitter)';
  readonly version = '1.0.0';
  readonly supportedFeatures: PlatformFeatures = {
    publishing: true,
    scheduling: true,
    analytics: true,
    engagement: true,
    dms: true,
    stories: false,
    reels: false,
    carousels: false,
    videos: true,
    webhooks: true,
  };

  // ── identity ────────────────────────────────────────────────────────────────

  getContentConstraints(): ContentConstraints {
    return {
      maxCaptionLength: 280,
      maxHashtags: 10,
      maxMentions: 50,
      supportedMediaTypes: ['image', 'video'],
      maxVideoDurationSec: 140,
      maxFileSizeMb: 512,
    };
  }

  getRateLimitInfo(): RateLimitConfig {
    return {
      requestsPerHour: 300,
      requestsPerDay: 7200,
      publishPerHour: 50,
      publishPerDay: 300,
    };
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    return buildTwitterOAuthUrl(state, redirectUri);
  }

  getPostUrl(postId: string, username = 'i'): string {
    return `https://twitter.com/${username}/status/${postId}`;
  }

  getProfileUrl(username: string): string {
    return `https://twitter.com/${username}`;
  }

  adaptContent(rawContent: RawContent, brand: BrandContext): AdaptedContent {
    const constraints = this.getContentConstraints();
    let caption = rawContent.caption;
    caption = this.filterProhibitedWords(caption, brand.prohibitedWords);

    const tags = this.dedupeHashtags(rawContent.hashtags || []).slice(
      0,
      constraints.maxHashtags,
    );

    // Twitter: hashtags inline, super-tight char budget.
    const final = this.buildFinalCaption(caption, tags, constraints.maxCaptionLength);

    return {
      caption: final.caption,
      media: rawContent.mediaAssets.slice(0, 4),
      hashtags: tags,
      mentions: this.extractMentions(caption),
      metadata: { tone: brand.tone, brandName: brand.brandName },
    };
  }

  // ── auth ────────────────────────────────────────────────────────────────────

  /**
   * Exchange an authorization code for OAuth tokens.
   *
   * The PKCE code verifier is looked up from the in-process Map that
   * buildTwitterOAuthUrl() populated when it stored it against the state value.
   * Pass the original `state` as the third argument so the verifier can be
   * retrieved; fall back to the env var for backwards-compat / testing.
   */
  async exchangeCode(
    code: string,
    redirectUri: string,
    state?: string,
  ): Promise<OAuthTokens> {
    const clientId = process.env.TWITTER_CLIENT_ID ?? '';
    const clientSecret = process.env.TWITTER_CLIENT_SECRET ?? '';

    // Retrieve the PKCE verifier that was stored when the OAuth URL was built.
    const codeVerifier =
      (state ? retrieveVerifier(state) : undefined) ??
      process.env.TWITTER_CODE_VERIFIER ??
      '';

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const tokenRes = await fetch(TWITTER_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    await assertOk(tokenRes);

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    // Fetch the authenticated user's profile info.
    const userRes = await fetch(
      `${TWITTER_API_URL}/users/me?user.fields=id,name,username,profile_image_url`,
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );
    await assertOk(userRes);

    const userData = (await userRes.json()) as {
      data: {
        id: string;
        name: string;
        username: string;
        profile_image_url?: string;
      };
    };

    const expiresInSeconds = tokenData.expires_in ?? 7200; // 2 hours default
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
      platformUserId: userData.data.id,
      platformUsername: userData.data.username,
      platformDisplayName: userData.data.name,
      platformAvatarUrl: userData.data.profile_image_url,
    };
  }

  /**
   * Refresh an existing Twitter OAuth 2.0 token.
   * Requires the `offline.access` scope (already in TWITTER_SCOPES).
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const clientId = process.env.TWITTER_CLIENT_ID ?? '';
    const clientSecret = process.env.TWITTER_CLIENT_SECRET ?? '';
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    });

    const tokenRes = await fetch(TWITTER_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    await assertOk(tokenRes);

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    // Re-fetch user info with the new token.
    const userRes = await fetch(
      `${TWITTER_API_URL}/users/me?user.fields=id,name,username,profile_image_url`,
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );
    await assertOk(userRes);

    const userData = (await userRes.json()) as {
      data: {
        id: string;
        name: string;
        username: string;
        profile_image_url?: string;
      };
    };

    const expiresInSeconds = tokenData.expires_in ?? 7200;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? refreshToken,
      expiresAt,
      scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
      platformUserId: userData.data.id,
      platformUsername: userData.data.username,
      platformDisplayName: userData.data.name,
      platformAvatarUrl: userData.data.profile_image_url,
    };
  }

  /** Returns true when the token can successfully reach the Twitter API. */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const res = await fetch(`${TWITTER_API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── publishing ──────────────────────────────────────────────────────────────

  /**
   * Create a tweet, optionally attaching already-uploaded media IDs.
   * Media upload (v1.1) is handled inline when content.media is non-empty.
   */
  async publish(content: AdaptedContent, credentials: Credentials): Promise<PublishResult> {
    const { accessToken } = credentials;

    // Upload media items if present (Twitter v1.1 upload endpoint).
    const mediaIds: string[] = [];
    for (const asset of content.media.slice(0, 4)) {
      try {
        const mediaId = await this.uploadMedia(asset.url, asset.mimeType ?? 'image/jpeg', accessToken);
        mediaIds.push(mediaId);
      } catch (err) {
        // Log but don't fail the entire publish if a media upload fails.
        console.error(`[TwitterPlugin] media upload failed for ${asset.url}:`, err);
      }
    }

    const tweetBody: Record<string, unknown> = { text: content.caption };
    if (mediaIds.length > 0) {
      tweetBody.media = { media_ids: mediaIds };
    }

    const res = await fetch(`${TWITTER_API_URL}/tweets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetBody),
    });
    await assertOk(res);

    const data = (await res.json()) as { data: { id: string; text: string } };
    const postId = data.data.id;

    // Attempt to get the username so the URL is human-readable.
    let username = 'i';
    try {
      const userRes = await fetch(`${TWITTER_API_URL}/users/me?user.fields=username`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userRes.ok) {
        const u = (await userRes.json()) as { data: { username: string } };
        username = u.data.username;
      }
    } catch {
      // fall back to /i/ URL
    }

    return {
      success: true,
      platformPostId: postId,
      platformUrl: this.getPostUrl(postId, username),
      publishedAt: new Date(),
    };
  }

  /**
   * Upload a single media item via Twitter's v1.1 media upload API.
   * Downloads the asset from `url` and streams it as multipart/form-data.
   */
  private async uploadMedia(url: string, mimeType: string, accessToken: string): Promise<string> {
    // Fetch the media bytes.
    const assetRes = await fetch(url);
    if (!assetRes.ok) {
      throw new Error(`Failed to fetch media asset: ${url}`);
    }
    const assetBuffer = await assetRes.arrayBuffer();

    // Build multipart body.
    const formData = new FormData();
    formData.append(
      'media',
      new Blob([assetBuffer], { type: mimeType }),
      'media',
    );

    const uploadRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    await assertOk(uploadRes);

    const uploadData = (await uploadRes.json()) as { media_id_string: string };
    return uploadData.media_id_string;
  }

  // ── analytics ───────────────────────────────────────────────────────────────

  async fetchPostAnalytics(postId: string, credentials: Credentials): Promise<PostAnalytics> {
    const res = await fetch(
      `${TWITTER_API_URL}/tweets/${postId}?tweet.fields=public_metrics`,
      {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      },
    );
    await assertOk(res);

    const data = (await res.json()) as {
      data: {
        id: string;
        public_metrics: {
          impression_count: number;
          retweet_count: number;
          reply_count: number;
          like_count: number;
          quote_count: number;
          bookmark_count?: number;
        };
      };
    };

    const m = data.data.public_metrics;
    const impressions = m.impression_count ?? 0;
    const likes = m.like_count ?? 0;
    const replies = m.reply_count ?? 0;
    const retweets = m.retweet_count ?? 0;
    const quotes = m.quote_count ?? 0;
    const engagement = likes + replies + retweets + quotes;
    const engagementRate = engagement / (impressions || 1);

    return {
      platformPostId: postId,
      impressions,
      reach: impressions, // Twitter doesn't expose reach separately
      engagement,
      likes,
      comments: replies,
      shares: retweets + quotes,
      saves: m.bookmark_count ?? 0,
      clicks: 0, // requires Promoted Tweet metrics
      engagementRate,
      fetchedAt: new Date(),
    };
  }

  // ── engagement ──────────────────────────────────────────────────────────────

  /**
   * Retrieve recent replies to a tweet by searching for tweets in the same
   * conversation thread using the v2 recent-search endpoint.
   */
  async fetchComments(postId: string, credentials: Credentials): Promise<Comment[]> {
    const query = encodeURIComponent(`conversation_id:${postId}`);
    const res = await fetch(
      `${TWITTER_API_URL}/tweets/search/recent?query=${query}&tweet.fields=author_id,created_at,in_reply_to_user_id&expansions=author_id&user.fields=username,profile_image_url&max_results=100`,
      {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      },
    );
    await assertOk(res);

    const data = (await res.json()) as {
      data?: Array<{
        id: string;
        text: string;
        author_id: string;
        created_at: string;
        in_reply_to_user_id?: string;
      }>;
      includes?: {
        users?: Array<{ id: string; username: string; profile_image_url?: string }>;
      };
    };

    const tweets = data.data ?? [];
    const usersById = new Map(
      (data.includes?.users ?? []).map((u) => [u.id, u]),
    );

    return tweets.map((tweet) => {
      const author = usersById.get(tweet.author_id);
      return {
        id: tweet.id,
        authorId: tweet.author_id,
        authorUsername: author?.username ?? tweet.author_id,
        authorAvatar: author?.profile_image_url,
        text: tweet.text,
        createdAt: new Date(tweet.created_at),
        isReply: !!tweet.in_reply_to_user_id,
        parentId: postId,
      } satisfies Comment;
    });
  }

  /** Reply to a tweet (works for both top-level tweets and existing replies). */
  async replyToComment(commentId: string, text: string, credentials: Credentials): Promise<ReplyResult> {
    const res = await fetch(`${TWITTER_API_URL}/tweets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        reply: { in_reply_to_tweet_id: commentId },
      }),
    });
    await assertOk(res);

    const data = (await res.json()) as { data: { id: string } };
    return {
      replyId: data.data.id,
      publishedAt: new Date(),
    };
  }
}
