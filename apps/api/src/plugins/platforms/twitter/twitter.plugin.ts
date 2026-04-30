import { BasePlatformPlugin } from '../../base-plugin';
import {
  PlatformFeatures,
  ContentConstraints,
  RawContent,
  BrandContext,
  AdaptedContent,
  RateLimitConfig,
} from '../../platform-plugin.interface';
import { buildTwitterOAuthUrl } from './twitter.auth';

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
}
