import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ImageGenerationService } from '../../image-generation/image-generation.service';
import { LoraGateway } from '../../lora/lora.gateway';
import type { AgentsService } from '../agents.service';
import type { ImageTaskType, BrandContext } from '../../image-generation/image-generation.types';
import { Prisma } from '@prisma/client';

export interface SteveGenerateInput {
  userId: string;
  businessId: string;
  campaignId?: string;
  taskId: string;
  platform?: string;
  creativeType: string;
  prompt: string;
  brandContext?: BrandContext;
  count?: number;
}

export interface SteveCarouselInput {
  userId: string;
  businessId: string;
  campaignId?: string;
  taskId: string;
  platform?: string;
  brandContext?: BrandContext;
  slides: Array<{
    slideNumber: number;
    slideGoal: string;
    headline: string;
    supportingText: string;
    imagePrompt: string;
  }>;
}

@Injectable()
export class SteveService {
  private readonly logger = new Logger(SteveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imageGen: ImageGenerationService,
    private readonly gateway: LoraGateway,
  ) {}

  // ─── Single image / ad creative ─────────────────────────────────────────────

  async generateVisualAsset(input: SteveGenerateInput) {
    const taskType = this.mapCreativeTypeToTask(input.creativeType);

    this.gateway.emitToUser(input.userId, 'steve.image.started', {
      taskId: input.taskId,
      platform: input.platform,
      message: `Steve is generating your ${input.creativeType}…`,
    });

    const images = await this.imageGen.generateImage({
      userId: input.userId,
      businessId: input.businessId,
      campaignId: input.campaignId,
      taskId: input.taskId,
      taskType,
      prompt: input.prompt,
      platform: input.platform,
      dimensions: this.platformDimensions(input.platform),
      count: input.count ?? 1,
      brandContext: input.brandContext,
    });

    const assets = await Promise.all(
      images.map((img) =>
        this.prisma.creativeAsset.create({
          data: {
            userId: input.userId,
            businessId: input.businessId,
            campaignId: input.campaignId ?? null,
            taskId: input.taskId,
            createdByAgent: 'Steve',
            assetType: input.creativeType,
            platform: input.platform ?? 'general',
            dimensions: img.dimensions ?? '1024x1024',
            assetUrl: img.assetUrl,
            storageKey: img.storageKey,
            storageProvider: 'cloudflare_r2',
            mimeType: img.mimeType,
            provider: img.provider,
            model: img.model,
            promptUsed: img.promptUsed,
            status: 'draft',
            approvalStatus: 'pending',
            metadata: { taskType } as Prisma.InputJsonValue,
          },
        }),
      ),
    );

    for (const asset of assets) {
      this.gateway.emitCreativeAssetReady(input.userId, asset);
    }

    this.logger.log(`[Steve] Generated ${assets.length} asset(s) for task=${input.taskId}`);
    return assets;
  }

  // ─── Carousel generation ─────────────────────────────────────────────────────

  async generateCarousel(input: SteveCarouselInput) {
    this.gateway.emitToUser(input.userId, 'steve.carousel.started', {
      taskId: input.taskId,
      slideCount: input.slides.length,
      message: `Steve is generating ${input.slides.length} carousel slides…`,
    });

    const generatedSlides: Array<{
      slideNumber: number;
      slideGoal: string;
      headline: string;
      supportingText: string;
      imagePrompt: string;
      assetUrl: string;
      creativeAssetId: string;
    }> = [];

    for (const slide of input.slides) {
      const images = await this.imageGen.generateImage({
        userId: input.userId,
        businessId: input.businessId,
        campaignId: input.campaignId,
        taskId: input.taskId,
        taskType: 'carousel_slide',
        prompt: slide.imagePrompt,
        platform: input.platform,
        dimensions: this.platformDimensions(input.platform),
        count: 1,
        brandContext: input.brandContext,
      });

      const img = images[0];
      if (!img) continue;

      const asset = await this.prisma.creativeAsset.create({
        data: {
          userId: input.userId,
          businessId: input.businessId,
          campaignId: input.campaignId ?? null,
          taskId: input.taskId,
          createdByAgent: 'Steve',
          assetType: 'carousel_slide',
          platform: input.platform ?? 'Instagram',
          title: slide.headline,
          dimensions: img.dimensions ?? '1024x1024',
          assetUrl: img.assetUrl,
          storageKey: img.storageKey,
          storageProvider: 'cloudflare_r2',
          mimeType: img.mimeType,
          provider: img.provider,
          model: img.model,
          promptUsed: img.promptUsed,
          slideNumber: slide.slideNumber,
          status: 'draft',
          approvalStatus: 'pending',
          metadata: {
            slideGoal: slide.slideGoal,
            headline: slide.headline,
            supportingText: slide.supportingText,
          } as Prisma.InputJsonValue,
        },
      });

      this.gateway.emitToUser(input.userId, 'steve.carousel.slide.generated', {
        taskId: input.taskId,
        slideNumber: slide.slideNumber,
        assetUrl: img.assetUrl,
        headline: slide.headline,
      });

      generatedSlides.push({
        slideNumber: slide.slideNumber,
        slideGoal: slide.slideGoal,
        headline: slide.headline,
        supportingText: slide.supportingText,
        imagePrompt: slide.imagePrompt,
        assetUrl: img.assetUrl,
        creativeAssetId: asset.id,
      });
    }

    this.logger.log(`[Steve] Generated carousel with ${generatedSlides.length} slides for task=${input.taskId}`);
    return generatedSlides;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private mapCreativeTypeToTask(creativeType: string): ImageTaskType {
    const map: Record<string, ImageTaskType> = {
      carousel_images: 'carousel_set',
      carousel_slide: 'carousel_slide',
      ad_creative: 'ad_creative',
      product_visual: 'product_visual',
      campaign_visual: 'campaign_visual',
      single_image: 'single_social_image',
      instagram_post: 'instagram_post',
      linkedin_carousel: 'linkedin_carousel',
      tiktok_cover: 'tiktok_cover',
    };
    return map[creativeType] ?? 'single_social_image';
  }

  private platformDimensions(platform?: string): string {
    const map: Record<string, string> = {
      Instagram: '1080x1080',
      TikTok: '1080x1920',
      LinkedIn: '1200x627',
      Facebook: '1200x628',
      Pinterest: '1000x1500',
      X: '1200x675',
      YouTube: '1280x720',
    };
    return map[platform ?? ''] ?? '1080x1080';
  }
}
