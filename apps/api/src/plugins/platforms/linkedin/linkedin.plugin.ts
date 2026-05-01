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
} from '../../platform-plugin.interface';
import {
  buildLinkedInOAuthUrl,
  LINKEDIN_TOKEN_URL,
  LINKEDIN_API_URL,
  LINKEDIN_SCOPES,
} from './linkedin.auth';
import { LinkedInTokenResponse, LinkedInProfileResponse } from './linkedin.types';

export class LinkedinPlugin extends BasePlatformPlugin {
  readonly platformName = 'linkedin';
  readonly displayName = 'LinkedIn';
  readonly version = '1.0.0';
  readonly supportedFeatures: PlatformFeatures = {
    publishing: true,
    scheduling: true,
    analytics: true,
    engagement: true,
    dms: false,
    stories: false,
    reels: false,
    carousels: true,
    videos: true,
    webhooks: false,
  };

  getContentConstraints(): ContentConstraints {
    return {
      maxCaptionLength: 3000,
      maxHashtags: 30,
      maxMentions: 50,
      supportedMediaTypes: ['image', 'video', 'document'],
      maxVideoDurationSec: 600,
      maxFileSizeMb: 200,
    };
  }

  getRateLimitInfo(): RateLimitConfig {
    return {
      requestsPerHour: 100,
      requestsPerDay: 1000,
      publishPerHour: 25,
      publishPerDay: 100,
    };
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    return buildLinkedInOAuthUrl(state, redirectUri);
  }

  getPostUrl(postId: string): string {
    return `https://www.linkedin.com/feed/update/${postId}/`;
  }

  getProfileUrl(username: string): string {
    return `https://www.linkedin.com/in/${username}/`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID ?? '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? '',
    });

    const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`LinkedIn token exchange failed (${tokenRes.status}): ${text}`);
    }

    const data = (await tokenRes.json()) as LinkedInTokenResponse;

    const profileRes = await fetch(
      `${LINKEDIN_API_URL}/me?projection=(id,localizedFirstName,localizedLastName,vanityName)`,
      { headers: { Authorization: `Bearer ${data.access_token}` } },
    );

    if (!profileRes.ok) {
      const text = await profileRes.text();
      throw new Error(`LinkedIn profile fetch failed (${profileRes.status}): ${text}`);
    }

    const profile = (await profileRes.json()) as LinkedInProfileResponse & { vanityName?: string };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      platformUserId: profile.id,
      platformUsername: profile.vanityName ?? profile.id,
      platformDisplayName:
        [profile.localizedFirstName, profile.localizedLastName].filter(Boolean).join(' ') ||
        undefined,
      scopes: LINKEDIN_SCOPES,
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID ?? '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? '',
    });

    const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`LinkedIn token refresh failed (${tokenRes.status}): ${text}`);
    }

    const data = (await tokenRes.json()) as LinkedInTokenResponse;

    // LinkedIn refresh tokens are valid for 60 days
    const expiresIn = data.expires_in ?? 60 * 24 * 60 * 60;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      platformUserId: '',
      platformUsername: '',
      scopes: LINKEDIN_SCOPES,
    };
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const res = await fetch(`${LINKEDIN_API_URL}/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async publish(content: AdaptedContent, credentials: Credentials): Promise<PublishResult> {
    const { accessToken, platformUserId } = credentials;
    const author = `urn:li:person:${platformUserId}`;

    const hasImage =
      content.media.length > 0 && content.media[0].type === 'image';

    // Build share media category and optional media array
    const shareContent: Record<string, unknown> = {
      shareCommentary: {
        text: [content.caption, content.hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ')]
          .filter(Boolean)
          .join('\n\n'),
      },
      shareMediaCategory: hasImage ? 'IMAGE' : 'NONE',
    };

    if (hasImage) {
      shareContent['media'] = content.media.map(m => ({
        status: 'READY',
        // media URL used as asset URN placeholder; callers should pass a digitalmediaAsset URN via metadata
        media: (content.metadata['mediaAssetUrn'] as string) ?? m.url,
        title: { text: m.altText ?? '' },
      }));
    }

    const body = {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': shareContent,
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const res = await fetch(`${LINKEDIN_API_URL}/ugcPosts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LinkedIn publish failed (${res.status}): ${text}`);
    }

    const result = (await res.json()) as { id: string };
    const rawId = result.id.replace('urn:li:ugcPost:', '');

    return {
      success: true,
      platformPostId: rawId,
      platformUrl: this.getPostUrl(result.id),
      publishedAt: new Date(),
    };
  }

  async fetchPostAnalytics(postId: string, credentials: Credentials): Promise<PostAnalytics> {
    const { accessToken } = credentials;

    const url =
      `${LINKEDIN_API_URL}/organizationalEntityShareStatistics` +
      `?q=organizationalEntity&organizationalEntity=urn:li:ugcPost:${postId}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LinkedIn analytics fetch failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as {
      elements?: Array<{
        totalShareStatistics: {
          impressionCount?: number;
          likeCount?: number;
          commentCount?: number;
          shareCount?: number;
          engagement?: number;
          clickCount?: number;
        };
      }>;
    };

    const stats = data.elements?.[0]?.totalShareStatistics ?? {};

    return {
      platformPostId: postId,
      impressions: stats.impressionCount ?? 0,
      reach: stats.impressionCount ?? 0,
      engagement: stats.likeCount ?? 0 + (stats.commentCount ?? 0) + (stats.shareCount ?? 0),
      likes: stats.likeCount ?? 0,
      comments: stats.commentCount ?? 0,
      shares: stats.shareCount ?? 0,
      saves: 0,
      clicks: stats.clickCount ?? 0,
      engagementRate: stats.engagement ?? 0,
      fetchedAt: new Date(),
    };
  }

  adaptContent(rawContent: RawContent, brand: BrandContext): AdaptedContent {
    const constraints = this.getContentConstraints();
    let caption = rawContent.caption;
    caption = this.filterProhibitedWords(caption, brand.prohibitedWords);

    // LinkedIn: hashtags at the bottom, max 5 ideal.
    const tags = this.dedupeHashtags([
      ...(rawContent.hashtags || []),
      ...brand.preferredHashtags,
    ]).slice(0, 5);

    const final = this.buildFinalCaption(caption, tags, constraints.maxCaptionLength);

    return {
      caption: final.caption,
      media: rawContent.mediaAssets,
      hashtags: tags,
      mentions: this.extractMentions(caption),
      metadata: { tone: brand.tone, brandName: brand.brandName },
    };
  }
}
