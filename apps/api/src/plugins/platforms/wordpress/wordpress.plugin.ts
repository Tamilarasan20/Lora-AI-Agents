import { BasePlatformPlugin } from '../../base-plugin';
import {
  PlatformFeatures,
  ContentConstraints,
  RawContent,
  BrandContext,
  AdaptedContent,
  RateLimitConfig,
} from '../../platform-plugin.interface';
import { buildWordPressOAuthUrl } from './wordpress.auth';

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
}
