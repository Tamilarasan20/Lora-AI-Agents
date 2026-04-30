import { BasePlatformPlugin } from '../../base-plugin';
import {
  PlatformFeatures,
  ContentConstraints,
  RawContent,
  BrandContext,
  AdaptedContent,
  RateLimitConfig,
} from '../../platform-plugin.interface';
import { buildTikTokOAuthUrl } from './tiktok.auth';

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
}
