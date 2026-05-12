import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IImageProvider } from '../image-generation.types';

@Injectable()
export class GeminiImageProvider implements IImageProvider {
  private readonly logger = new Logger(GeminiImageProvider.name);

  constructor(private readonly config: ConfigService) {}

  async generate(
    prompt: string,
    options: { dimensions?: string; count?: number; negativePrompt?: string },
  ): Promise<{ imageBuffer: Buffer; mimeType: string; model: string }[]> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY', '');
    const n = Math.min(options.count ?? 1, 4);

    this.logger.log(`Gemini image generation n=${n}`);

    const results: { imageBuffer: Buffer; mimeType: string; model: string }[] = [];

    for (let i = 0; i < n; i++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: prompt.slice(0, 2000) }],
            parameters: {
              sampleCount: 1,
              ...(options.negativePrompt ? { negativePrompt: options.negativePrompt } : {}),
            },
          }),
        },
      );

      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Gemini image generation error: ${res.status} ${body}`);
        throw new Error(`Gemini image generation failed: ${res.status}`);
      }

      const data = await res.json() as { predictions?: { bytesBase64Encoded: string; mimeType: string }[] };
      const prediction = data.predictions?.[0];

      if (prediction?.bytesBase64Encoded) {
        results.push({
          imageBuffer: Buffer.from(prediction.bytesBase64Encoded, 'base64'),
          mimeType: prediction.mimeType ?? 'image/png',
          model: 'imagen-3.0-generate-001',
        });
      }
    }

    return results;
  }
}
