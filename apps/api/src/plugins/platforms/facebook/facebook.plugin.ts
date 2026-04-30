import { BasePlatformPlugin } from '../../base-plugin';
import {
  PlatformFeatures,
  ContentConstraints,
  RawContent,
  BrandContext,
  AdaptedContent,
  RateLimitConfig,
} from '../../platform-plugin.interface';
import { buildFacebookOAuthUrl } from './facebook.auth';

export class FacebookPlugin extends BasePlatformPlugin {
  readonly platformName = 'facebook';
  readonly displayName = 'Facebook';
  readonly version = '1.0.0';
  readonly supportedFeatures: PlatformFeatures = {
    publishing: true,
    scheduling: true,
    analytics: true,
    engagement: true,
    dms: true,
    stories: true,
    reels: true,
    carousels: true,
    videos: true,
    webhooks: true,
  };

  getContentConstraints(): ContentConstraints {
    return {
      maxCaptionLength: 63206,
      maxHashtags: 30,
      maxMentions: 50,
      supportedMediaTypes: ['image', 'video'],
      maxVideoDurationSec: 14400, // 4 hours
      maxFileSizeMb: 10240,
    };
  }

  getRateLimitInfo(): RateLimitConfig {
    return {
      requestsPerHour: 200,
      requestsPerDay: 4800,
      publishPerHour: 25,
      publishPerDay: 200,
    };
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    return buildFacebookOAuthUrl(state, redirectUri);
  }

  getPostUrl(postId: string): string {
    return `https://www.facebook.com/${postId}`;
  }

  getProfileUrl(username: string): string {
    return `https://www.facebook.com/${username}`;
  }

  adaptContent(rawContent: RawContent, brand: BrandContext): AdaptedContent {
    const constraints = this.getContentConstraints();
    let caption = rawContent.caption;
    caption = this.filterProhibitedWords(caption, brand.prohibitedWords);

    const tags = this.dedupeHashtags([
      ...(rawContent.hashtags || []),
      ...brand.preferredHashtags,
    ]).slice(0, constraints.maxHashtags);

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
