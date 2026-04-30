import { BasePlatformPlugin } from '../../base-plugin';
import {
  PlatformFeatures,
  ContentConstraints,
  RawContent,
  BrandContext,
  AdaptedContent,
  RateLimitConfig,
} from '../../platform-plugin.interface';
import { buildInstagramOAuthUrl } from './instagram.auth';

export class InstagramPlugin extends BasePlatformPlugin {
  readonly platformName = 'instagram';
  readonly displayName = 'Instagram';
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
      maxCaptionLength: 2200,
      maxHashtags: 30,
      maxMentions: 20,
      supportedMediaTypes: ['image', 'video'],
      maxVideoDurationSec: 90,
      maxFileSizeMb: 100,
      minAspectRatio: 0.8,
      maxAspectRatio: 1.91,
    };
  }

  getRateLimitInfo(): RateLimitConfig {
    return {
      requestsPerHour: 200,
      requestsPerDay: 4800,
      publishPerHour: 25,
      publishPerDay: 100,
    };
  }

  getOAuthUrl(state: string, redirectUri: string): string {
    return buildInstagramOAuthUrl(state, redirectUri);
  }

  getPostUrl(postId: string): string {
    return `https://www.instagram.com/p/${postId}/`;
  }

  getProfileUrl(username: string): string {
    return `https://www.instagram.com/${username}/`;
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
      firstComment: final.firstComment,
      metadata: { tone: brand.tone, brandName: brand.brandName },
    };
  }

  // getOptimalPostingTimes default from base; refine when Instagram audience data lands.
}
