export type ImageProvider = 'openai' | 'gemini' | 'replicate';

export type ImageTaskType =
  | 'single_social_image'
  | 'carousel_slide'
  | 'carousel_set'
  | 'ad_creative'
  | 'product_visual'
  | 'campaign_visual'
  | 'tiktok_cover'
  | 'instagram_post'
  | 'linkedin_carousel';

export interface BrandContext {
  brandName?: string;
  brandVoice?: string;
  colors?: string[];
  visualStyle?: string;
  audience?: string;
  doList?: string[];
  dontList?: string[];
}

export interface GenerateImageInput {
  userId: string;
  businessId: string;
  campaignId?: string;
  taskId?: string;
  calendarItemId?: string;
  provider?: ImageProvider;
  taskType: ImageTaskType;
  prompt: string;
  negativePrompt?: string;
  platform?: string;
  dimensions?: string;
  count?: number;
  brandContext?: BrandContext;
  metadata?: Record<string, unknown>;
}

export interface GeneratedImageResult {
  provider: ImageProvider;
  model: string;
  assetUrl: string;
  storageKey: string;
  mimeType: string;
  dimensions?: string;
  promptUsed: string;
  rawProviderResponse?: unknown;
}

export interface ImageRoutingInput {
  userId: string;
  businessId: string;
  taskType: ImageTaskType;
  prompt: string;
  platform?: string;
  needsReadableText?: boolean;
  needsProductRealism?: boolean;
  needsBrandConsistency?: boolean;
  count?: number;
}

export interface ImageRoutingDecision {
  provider: ImageProvider;
  model: string;
  reason: string;
  estimatedCredits: number;
  fallbackProvider: ImageProvider;
}

export interface IImageProvider {
  generate(
    prompt: string,
    options: {
      dimensions?: string;
      count?: number;
      negativePrompt?: string;
    },
  ): Promise<{ imageBuffer: Buffer; mimeType: string; model: string }[]>;
}
