/**
 * Loraloop AI Growth Pod - Type Definitions
 */

export type Platform = 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'blog';
export type ContentType = 'image' | 'video' | 'text';

export interface OrchestratorInput {
  businessId?: string;
  /** Workspace whose memory should be retrieved + appended. If absent, orchestration runs cold. */
  workspaceId?: string;
  goal: string;
  platform: Platform;
  contentTypes: ContentType[];
  useMockData?: boolean;
  preferences?: {
    style?: string;
    colors?: string[];
    tone?: string;
    imageType?: string;
    videoStyle?: string;
    reference?: string;
    aspectRatio?: string;
  };
}

export interface EnrichedData {
  brandName: string;
  businessOverview: string;
  brandValues: string[];
  brandAesthetic: string;
  toneOfVoice: string;
  tagline: string;
  logoUrl?: string;
}

export interface BrandColors {
  primary?: string;
  secondary?: string;
  background?: string;
  accent?: string;
  textHighContrast?: string;
  [key: string]: string | undefined;
}

export interface BrandTypography {
  headingFont: string;
  bodyFont: string;
}

export interface BrandGuidelines {
  colors: BrandColors;
  typography: BrandTypography;
  logos?: string[];
  images: string[];
}

export interface BusinessKnowledgeBase {
  enrichedData: EnrichedData;
  brandGuidelines: BrandGuidelines;
  businessProfile?: string;
  marketResearch?: string;
  socialStrategy?: string;
}

export interface BrandVoice {
  tone: string;
  vocabulary: string[];
  colors: BrandColors;
  fonts: BrandTypography;
  imageStyle: string;
  videoStyle: string;
  tagline: string;
  values: string[];
  aesthetic: string;
}

export interface LoraOutput {
  contentType: ContentType[];
  angle: string;
  messaging: string;
  platformAdaptation: string;
  tone: string;
  keyThemes: string[];
}

export interface TextOverlay {
  text: string;
  placement: 'top' | 'bottom' | 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size: 'small' | 'medium' | 'large';
  color?: string;
  backgroundColor?: string;
}

export interface ClaraOutput {
  hook: string;
  coreMessage: string;
  textOverlays: TextOverlay[];
  keyPhrases: string[];
  caption: string;
  hashtags: string[];
  callToAction?: string;
}

export type AspectRatio = '1:1' | '4:3' | '4:5' | '2:1' | '16:9' | '9:16' | '3:2' | '1.91:1' | 'custom';

export interface PlatformDimensions {
  width: number;
  height: number;
  ratio: AspectRatio;
}

export const PLATFORM_DIMENSIONS: Record<Platform, PlatformDimensions> = {
  instagram: { width: 1080, height: 1350, ratio: '4:5' },
  twitter: { width: 1200, height: 675, ratio: '16:9' },
  linkedin: { width: 1200, height: 627, ratio: '1.91:1' },
  tiktok: { width: 1080, height: 1920, ratio: '9:16' },
  blog: { width: 1200, height: 600, ratio: '2:1' },
};

export interface StevePrompt {
  prompt: string;
  style: string;
  composition: string;
  colors: string;
  textOverlay: string;
  aspectRatio: AspectRatio;
  platform: Platform;
  brandColors?: BrandColors;
  brandFonts?: BrandTypography;
  metadata?: {
    platform: Platform;
    dimensions: string;
  };
}

export interface SteveOutput {
  prompt: StevePrompt;
  imageUrl?: string;
  generatedAt?: string;
}

export interface TextOutput {
  caption: string;
  hashtags: string[];
  keyPhrases: string[];
  callToAction?: string;
  mentionTags?: string[];
}

export interface ImageOutput {
  url?: string;
  prompt: string;
  metadata: {
    platform: Platform;
    dimensions: string;
    generatedAt: string;
  };
}

export interface VideoOutput {
  url?: string;
  prompt: string;
  metadata: {
    platform: Platform;
    duration: number;
    format: 'vertical' | 'horizontal';
    generatedAt: string;
  };
}

export interface OrchestratorOutput {
  image?: ImageOutput;
  video?: VideoOutput;
  text?: TextOutput;
  metadata: {
    businessId?: string;
    businessName?: string;
    platform: Platform;
    goal: string;
    generatedAt: string;
    brandVoice: string;
    usedMockData: boolean;
    processingTime: number;
    agentDecisions: {
      lora: LoraOutput;
      clara: ClaraOutput;
    };
  };
}

export interface AgentError {
  agent: 'lora' | 'clara' | 'steve' | 'orchestrator' | 'gemini';
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface OrchestratorError extends AgentError {
  partialOutput?: Partial<OrchestratorOutput>;
}
