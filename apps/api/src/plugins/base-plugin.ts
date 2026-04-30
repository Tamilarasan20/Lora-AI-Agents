import {
  IPlatformPlugin,
  PlatformFeatures,
  RawContent,
  BrandContext,
  AdaptedContent,
  ValidationResult,
  ContentConstraints,
  OAuthTokens,
  Credentials,
  PublishResult,
  PostAnalytics,
  AccountAnalytics,
  AudienceInsights,
  Comment,
  DirectMessage,
  ReplyResult,
  RateLimitConfig,
  RateLimitStatus,
  OptimalTime,
  WebhookEvent,
  MediaAsset,
  NotImplementedError,
} from './platform-plugin.interface';

/**
 * Abstract base class providing shared helpers for all platform plugins.
 *
 * Concrete plugins should:
 * 1. Set platformName, displayName, version, supportedFeatures.
 * 2. Override getContentConstraints() with platform-specific limits.
 * 3. Implement adaptContent() using helpers from this class.
 * 4. Implement OAuth + API methods (or leave as TODO throwing NotImplementedError).
 */
export abstract class BasePlatformPlugin implements IPlatformPlugin {
  abstract readonly platformName: string;
  abstract readonly displayName: string;
  abstract readonly version: string;
  abstract readonly supportedFeatures: PlatformFeatures;

  // ─── must override ──────────────────────────────
  abstract getContentConstraints(): ContentConstraints;
  abstract adaptContent(rawContent: RawContent, brand: BrandContext): AdaptedContent;
  abstract getOAuthUrl(state: string, redirectUri: string): string;
  abstract getRateLimitInfo(): RateLimitConfig;
  abstract getPostUrl(postId: string, username?: string): string;
  abstract getProfileUrl(username: string): string;

  // ─── default validation using constraints ───────
  validateContent(content: AdaptedContent): ValidationResult {
    const constraints = this.getContentConstraints();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content.caption || content.caption.trim().length === 0) {
      errors.push('Caption cannot be empty');
    }

    if (content.caption && content.caption.length > constraints.maxCaptionLength) {
      errors.push(
        `Caption exceeds max length of ${constraints.maxCaptionLength} chars`,
      );
    }

    if (content.hashtags.length > constraints.maxHashtags) {
      errors.push(`Exceeds max ${constraints.maxHashtags} hashtags`);
    }

    errors.push(...this.validateMediaAssets(content.media, constraints));

    return { valid: errors.length === 0, errors, warnings };
  }

  // ─── default stubs (override in concrete plugins) ────
  exchangeCode(_code: string, _redirectUri: string): Promise<OAuthTokens> {
    throw new NotImplementedError(this.platformName, 'exchangeCode');
  }
  refreshToken(_refreshToken: string): Promise<OAuthTokens> {
    throw new NotImplementedError(this.platformName, 'refreshToken');
  }
  validateToken(_accessToken: string): Promise<boolean> {
    throw new NotImplementedError(this.platformName, 'validateToken');
  }
  revokeToken(_accessToken: string): Promise<void> {
    throw new NotImplementedError(this.platformName, 'revokeToken');
  }

  publish(_content: AdaptedContent, _credentials: Credentials): Promise<PublishResult> {
    throw new NotImplementedError(this.platformName, 'publish');
  }
  publishCarousel(
    _slides: AdaptedContent[],
    _credentials: Credentials,
  ): Promise<PublishResult> {
    throw new NotImplementedError(this.platformName, 'publishCarousel');
  }
  publishStory(_content: AdaptedContent, _credentials: Credentials): Promise<PublishResult> {
    throw new NotImplementedError(this.platformName, 'publishStory');
  }
  publishVideo(_content: AdaptedContent, _credentials: Credentials): Promise<PublishResult> {
    throw new NotImplementedError(this.platformName, 'publishVideo');
  }
  deletePost(_postId: string, _credentials: Credentials): Promise<void> {
    throw new NotImplementedError(this.platformName, 'deletePost');
  }
  editPost(
    _postId: string,
    _content: Partial<AdaptedContent>,
    _credentials: Credentials,
  ): Promise<void> {
    throw new NotImplementedError(this.platformName, 'editPost');
  }

  fetchPostAnalytics(_postId: string, _credentials: Credentials): Promise<PostAnalytics> {
    throw new NotImplementedError(this.platformName, 'fetchPostAnalytics');
  }
  fetchBulkAnalytics(
    _postIds: string[],
    _credentials: Credentials,
  ): Promise<PostAnalytics[]> {
    throw new NotImplementedError(this.platformName, 'fetchBulkAnalytics');
  }
  fetchAccountAnalytics(_credentials: Credentials): Promise<AccountAnalytics> {
    throw new NotImplementedError(this.platformName, 'fetchAccountAnalytics');
  }
  fetchAudienceInsights(_credentials: Credentials): Promise<AudienceInsights> {
    // Returns platform-generic baseline until the concrete plugin overrides with real API call.
    // Shape matches PlatformAudienceInsights schema — persisted by SyncAudienceAnalyticsProcessor.
    return Promise.resolve({
      hourlyOnlineFollowers: {},
      hourlyEngagementRate: {},
      dailyEngagementMultiplier: { '0': 0.85, '1': 1.1, '2': 1.3, '3': 1.25, '4': 1.2, '5': 0.95, '6': 0.8 },
      platformRecommendedTimes: this.getOptimalPostingTimes().map((t) => ({
        hour: t.hourOfDay,
        dayOfWeek: t.dayOfWeek,
        score: t.score / 100,
      })),
      followerCount: 0,
      topCountries: [],
      topAgeRange: undefined,
      topGender: undefined,
      genderSplit: { male: 0, female: 0, other: 0 },
      avgDailyImpressions: 0,
      avgDailyReach: 0,
      avgEngagementRate: 0,
      fetchedAt: new Date(),
    });
  }

  fetchComments(_postId: string, _credentials: Credentials): Promise<Comment[]> {
    throw new NotImplementedError(this.platformName, 'fetchComments');
  }
  fetchDMs(_credentials: Credentials): Promise<DirectMessage[]> {
    throw new NotImplementedError(this.platformName, 'fetchDMs');
  }
  replyToComment(
    _commentId: string,
    _text: string,
    _credentials: Credentials,
  ): Promise<ReplyResult> {
    throw new NotImplementedError(this.platformName, 'replyToComment');
  }
  sendDM(_recipientId: string, _text: string, _credentials: Credentials): Promise<void> {
    throw new NotImplementedError(this.platformName, 'sendDM');
  }
  likeComment(_commentId: string, _credentials: Credentials): Promise<void> {
    throw new NotImplementedError(this.platformName, 'likeComment');
  }
  deleteComment(_commentId: string, _credentials: Credentials): Promise<void> {
    throw new NotImplementedError(this.platformName, 'deleteComment');
  }

  checkRateLimit(_userId: string): Promise<RateLimitStatus> {
    const info = this.getRateLimitInfo();
    return Promise.resolve({
      remaining: info.requestsPerHour,
      resetAt: new Date(Date.now() + 3_600_000),
      isLimited: false,
    });
  }

  parseWebhookEvent(_payload: unknown): WebhookEvent | null {
    return null;
  }

  getOptimalPostingTimes(): OptimalTime[] {
    // Generic baseline — overridden per platform when better data exists.
    return [
      { dayOfWeek: 2, hourOfDay: 9, score: 80 },
      { dayOfWeek: 3, hourOfDay: 12, score: 85 },
      { dayOfWeek: 4, hourOfDay: 17, score: 82 },
    ];
  }

  // ─── shared adaptation helpers ──────────────────

  protected truncateCaption(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  protected formatHashtags(hashtags: string[]): string {
    return hashtags.map(h => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  }

  protected extractMentions(text: string): string[] {
    const matches = text.match(/@[\w.]+/g) || [];
    return matches.map(m => m.replace('@', ''));
  }

  protected buildFinalCaption(
    caption: string,
    hashtags: string[],
    maxLength: number,
    hashtagsInFirstComment = false,
  ): { caption: string; firstComment?: string } {
    const hashtagStr = this.formatHashtags(hashtags);

    if (hashtagsInFirstComment) {
      return {
        caption: this.truncateCaption(caption, maxLength),
        firstComment: hashtagStr,
      };
    }

    const fullCaption = hashtagStr ? `${caption}\n\n${hashtagStr}` : caption;
    if (fullCaption.length <= maxLength) {
      return { caption: fullCaption };
    }

    const spaceForHashtags = hashtagStr.length + 2;
    const truncatedCaption = this.truncateCaption(caption, maxLength - spaceForHashtags);
    return { caption: `${truncatedCaption}\n\n${hashtagStr}` };
  }

  protected filterProhibitedWords(text: string, prohibitedWords: string[]): string {
    let filtered = text;
    for (const word of prohibitedWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      filtered = filtered.replace(regex, '***');
    }
    return filtered;
  }

  protected validateMediaAssets(
    media: MediaAsset[],
    constraints: ContentConstraints,
  ): string[] {
    const errors: string[] = [];

    for (const asset of media) {
      if (!constraints.supportedMediaTypes.includes(asset.type)) {
        errors.push(`Media type ${asset.type} not supported on ${this.platformName}`);
      }
      if (asset.fileSize && asset.fileSize > constraints.maxFileSizeMb * 1024 * 1024) {
        errors.push(`File size exceeds ${constraints.maxFileSizeMb}MB limit`);
      }
      if (asset.duration && asset.duration > constraints.maxVideoDurationSec) {
        errors.push(`Video duration exceeds ${constraints.maxVideoDurationSec}s limit`);
      }
    }

    return errors;
  }

  protected dedupeHashtags(hashtags: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const h of hashtags) {
      const normalized = h.replace(/^#/, '').toLowerCase();
      if (!seen.has(normalized) && normalized.length > 0) {
        seen.add(normalized);
        out.push(h.replace(/^#/, ''));
      }
    }
    return out;
  }

  /** Retry-safe API call wrapper with exponential backoff. */
  protected async apiCall<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 1000,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error;
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status && [400, 401, 403, 404, 422].includes(status)) {
          throw error;
        }
        if (attempt < maxRetries) {
          const delay = baseDelayMs * 2 ** (attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}
