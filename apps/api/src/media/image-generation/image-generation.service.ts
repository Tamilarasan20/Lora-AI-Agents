import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { StorageService } from '../../storage/storage.service';
import { OpenAIImageProvider } from './providers/openai-image.provider';
import { GeminiImageProvider } from './providers/gemini-image.provider';
import type {
  GenerateImageInput,
  GeneratedImageResult,
  ImageRoutingInput,
  ImageRoutingDecision,
  ImageTaskType,
  ImageProvider,
} from './image-generation.types';

@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly openai: OpenAIImageProvider,
    private readonly gemini: GeminiImageProvider,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────────

  async generateImage(input: GenerateImageInput): Promise<GeneratedImageResult[]> {
    const routing = input.provider
      ? this.buildDecisionForProvider(input.provider, input.taskType)
      : this.routeImageModel({
          userId: input.userId,
          businessId: input.businessId,
          taskType: input.taskType,
          prompt: input.prompt,
          platform: input.platform,
        });

    this.logger.log(
      `[ImageGen] provider=${routing.provider} model=${routing.model} reason="${routing.reason}"`,
    );

    const brandedPrompt = this.buildBrandedPrompt(input.prompt, input.brandContext);
    const count = input.count ?? 1;

    return this.generateWithFallback(
      brandedPrompt,
      routing,
      { dimensions: input.dimensions, count, negativePrompt: input.negativePrompt },
      input,
    );
  }

  routeImageModel(input: ImageRoutingInput): ImageRoutingDecision {
    const prompt = input.prompt.toLowerCase();

    const needsText =
      prompt.includes('text') ||
      prompt.includes('headline') ||
      prompt.includes('poster') ||
      prompt.includes('banner') ||
      prompt.includes('carousel') ||
      prompt.includes('title') ||
      prompt.includes('caption');

    const isCarousel =
      input.taskType === 'carousel_set' ||
      input.taskType === 'carousel_slide' ||
      input.taskType === 'linkedin_carousel' ||
      prompt.includes('carousel');

    const needsRealism =
      input.needsProductRealism ||
      prompt.includes('product') ||
      prompt.includes('photorealistic') ||
      prompt.includes('realistic') ||
      prompt.includes('lifestyle') ||
      prompt.includes('photography');

    if (needsText || isCarousel) {
      return {
        provider: 'openai',
        model: 'dall-e-3',
        reason: 'OpenAI selected for readable text, layout control, and carousel consistency.',
        estimatedCredits: isCarousel ? 6 : 3,
        fallbackProvider: 'gemini',
      };
    }

    if (needsRealism) {
      return {
        provider: 'gemini',
        model: 'imagen-3.0-generate-001',
        reason: 'Gemini selected for realistic product and lifestyle image generation.',
        estimatedCredits: 3,
        fallbackProvider: 'openai',
      };
    }

    return {
      provider: this.config.get<ImageProvider>('IMAGE_DEFAULT_PROVIDER', 'openai'),
      model: 'dall-e-3',
      reason: 'Default marketing image provider selected.',
      estimatedCredits: 3,
      fallbackProvider: 'gemini',
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async generateWithFallback(
    prompt: string,
    routing: ImageRoutingDecision,
    options: { dimensions?: string; count?: number; negativePrompt?: string },
    input: GenerateImageInput,
  ): Promise<GeneratedImageResult[]> {
    const providers: ImageProvider[] = [routing.provider, routing.fallbackProvider];

    for (const providerName of providers) {
      try {
        const provider = this.getProvider(providerName);
        const raw = await provider.generate(prompt, options);
        const results: GeneratedImageResult[] = [];

        for (let i = 0; i < raw.length; i++) {
          const { imageBuffer, mimeType, model } = raw[i];
          const ext = mimeType.includes('webp') ? 'webp' : mimeType.includes('jpg') ? 'jpg' : 'png';
          const storageKey = `creative-assets/${input.userId}/${input.businessId}/${uuidv4()}.${ext}`;

          const stored = await this.storage.putObject(storageKey, imageBuffer, mimeType, {
            userId: input.userId,
            businessId: input.businessId,
            provider: providerName,
            taskType: input.taskType,
          });

          results.push({
            provider: providerName,
            model,
            assetUrl: stored.publicUrl,
            storageKey,
            mimeType,
            dimensions: input.dimensions ?? '1024x1024',
            promptUsed: prompt,
          });
        }

        this.logger.log(`[ImageGen] Generated ${results.length} image(s) via ${providerName}`);
        return results;
      } catch (err) {
        this.logger.warn(`[ImageGen] ${providerName} failed: ${err} — trying fallback`);
        if (providerName === routing.fallbackProvider) throw err;
      }
    }

    throw new Error('All image generation providers failed');
  }

  private getProvider(name: ImageProvider) {
    if (name === 'gemini') return this.gemini;
    return this.openai;
  }

  private buildDecisionForProvider(provider: ImageProvider, taskType: ImageTaskType): ImageRoutingDecision {
    return {
      provider,
      model: provider === 'gemini' ? 'imagen-3.0-generate-001' : 'dall-e-3',
      reason: 'Provider explicitly specified by caller.',
      estimatedCredits: 3,
      fallbackProvider: provider === 'openai' ? 'gemini' : 'openai',
    };
  }

  private buildBrandedPrompt(prompt: string, brandContext?: GenerateImageInput['brandContext']): string {
    if (!brandContext) return prompt;

    const parts: string[] = [prompt];

    if (brandContext.visualStyle) parts.push(`Visual style: ${brandContext.visualStyle}.`);
    if (brandContext.colors?.length) parts.push(`Brand colors: ${brandContext.colors.join(', ')}.`);
    if (brandContext.audience) parts.push(`Target audience: ${brandContext.audience}.`);
    if (brandContext.doList?.length) parts.push(`Include: ${brandContext.doList.join(', ')}.`);
    if (brandContext.dontList?.length) parts.push(`Avoid: ${brandContext.dontList.join(', ')}.`);

    return parts.join(' ');
  }
}
