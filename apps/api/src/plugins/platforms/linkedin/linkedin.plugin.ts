import { BasePlatformPlugin } from '../../base-plugin';
import {
  PlatformFeatures,
  ContentConstraints,
  RawContent,
  BrandContext,
  AdaptedContent,
  RateLimitConfig,
} from '../../platform-plugin.interface';
import { buildLinkedInOAuthUrl } from './linkedin.auth';

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
