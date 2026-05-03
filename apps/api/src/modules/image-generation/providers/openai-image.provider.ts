import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { IImageProvider } from '../image-generation.types';

@Injectable()
export class OpenAIImageProvider implements IImageProvider {
  private readonly logger = new Logger(OpenAIImageProvider.name);
  private client: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({ apiKey: this.config.get<string>('OPENAI_API_KEY', '') });
  }

  async generate(
    prompt: string,
    options: { dimensions?: string; count?: number; negativePrompt?: string },
  ): Promise<{ imageBuffer: Buffer; mimeType: string; model: string }[]> {
    const size = this.mapDimensions(options.dimensions ?? '1080x1080');
    const n = Math.min(options.count ?? 1, 4);

    this.logger.log(`OpenAI image generation: size=${size} n=${n}`);

    try {
      const response = await this.client.images.generate({
        model: 'dall-e-3',
        prompt: prompt.slice(0, 4000),
        n: 1, // dall-e-3 only supports n=1
        size,
        response_format: 'b64_json',
        quality: 'standard',
      });

      const results: { imageBuffer: Buffer; mimeType: string; model: string }[] = [];

      for (const img of response.data ?? []) {
        if (img.b64_json) {
          results.push({
            imageBuffer: Buffer.from(img.b64_json, 'base64'),
            mimeType: 'image/png',
            model: 'dall-e-3',
          });
        }
      }

      // If multiple needed, make additional calls
      const extraCalls = n - 1;
      for (let i = 0; i < extraCalls; i++) {
        const extra = await this.client.images.generate({
          model: 'dall-e-3',
          prompt: prompt.slice(0, 4000),
          n: 1,
          size,
          response_format: 'b64_json',
          quality: 'standard',
        });
        if ((extra.data ?? [])[0]?.b64_json) {
          results.push({
            imageBuffer: Buffer.from(((extra.data ?? [])[0]!.b64_json) as string, 'base64'),
            mimeType: 'image/png',
            model: 'dall-e-3',
          });
        }
      }

      return results;
    } catch (err) {
      this.logger.error(`OpenAI image generation failed: ${err}`);
      throw err;
    }
  }

  private mapDimensions(dim: string): '1024x1024' | '1792x1024' | '1024x1792' {
    if (dim.includes('1920') || dim.includes('1792') || dim.includes('landscape')) return '1792x1024';
    if (dim.includes('portrait') || dim.includes('9:16') || dim.includes('1080x1920')) return '1024x1792';
    return '1024x1024';
  }
}
