import { BasePlatformPlugin } from '../../base-plugin';
import {
  PlatformFeatures,
  ContentConstraints,
  RawContent,
  BrandContext,
  AdaptedContent,
  RateLimitConfig,
} from '../../platform-plugin.interface';
import { buildPinterestOAuthUrl } from './pinterest.auth';

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
}
