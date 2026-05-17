export type VideoProvider = 'runway' | 'luma' | 'pika' | 'kling';
export type VideoAspectRatio = '9:16' | '16:9' | '1:1';

export interface GenerateVideoInput {
  userId: string;
  businessId: string;
  taskId: string;
  campaignId?: string;
  prompt: string;
  imageUrl?: string;       // for image-to-video
  aspectRatio?: VideoAspectRatio;
  durationSec?: number;
  provider?: VideoProvider;
  brandContext?: {
    brandColors?: string[];
    visualStyle?: string;
    tone?: string;
    targetAudience?: string;
  };
}

export interface GeneratedVideoResult {
  provider: VideoProvider;
  model: string;
  assetUrl: string;
  storageKey: string;
  mimeType: string;
  durationSec: number;
  aspectRatio: VideoAspectRatio;
  promptUsed: string;
}

export interface IVideoProvider {
  generate(prompt: string, options: {
    aspectRatio?: VideoAspectRatio;
    durationSec?: number;
    imageUrl?: string;
  }): Promise<{ videoUrl: string; model: string; durationSec: number }>;
}
