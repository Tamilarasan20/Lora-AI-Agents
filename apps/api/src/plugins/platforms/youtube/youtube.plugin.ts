import { BasePlatformPlugin } from '../../base-plugin';
import {
  PlatformFeatures,
  ContentConstraints,
  RawContent,
  BrandContext,
  AdaptedContent,
  RateLimitConfig,
} from '../../platform-plugin.interface';
import { buildYouTubeOAuthUrl } from './youtube.auth';

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
}
