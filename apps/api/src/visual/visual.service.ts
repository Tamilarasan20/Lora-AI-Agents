import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { VectorService } from '../vector/vector.service';
import { VECTOR_COLLECTIONS } from '../vector/vector.types';
import { QueueService } from '../queue/queue.service';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';

export interface VisualAnalysisResult {
  assetType: 'product' | 'lifestyle' | 'team' | 'logo' | 'infographic' | 'banner' | 'background' | 'other';
  style: string;
  colors: string[];
  lighting: 'studio' | 'natural' | 'dark' | 'bright' | 'unknown';
  composition: string;
  mood: string;
  brandingStyle: string;
  useCase: 'ads' | 'social' | 'website_hero' | 'product_page' | 'blog' | 'email' | 'other';
  tags: string[];
  adSuitability: 'high' | 'medium' | 'low';
  suggestedCaption: string;
}

@Injectable()
export class VisualService {
  private readonly logger = new Logger(VisualService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly vector: VectorService,
    private readonly queue: QueueService,
    private readonly config: ConfigService,
  ) {
    const key = this.config.get<string>('GEMINI_API_KEY') ?? process.env.GEMINI_API_KEY;
    if (key) {
      this.genAI = new GoogleGenerativeAI(key);
    } else {
      this.logger.warn('GEMINI_API_KEY not set — visual analysis will be skipped');
    }
  }

  async queueImagesForProject(userId: string, projectId: string, crawlId: string) {
    const pages = await this.prisma.crawledPage.findMany({
      where: { crawlId, status: 'DONE' },
      select: { imageUrls: true },
    });

    const allImages = pages.flatMap((p) => p.imageUrls).slice(0, 100);
    this.logger.log(`Queueing ${allImages.length} images for visual analysis`);

    for (const imageUrl of allImages) {
      await this.queue.addJob(QUEUE_NAMES.AKE_VISUAL, JOB_NAMES.AKE_ANALYZE_IMAGE, {
        userId,
        projectId,
        imageUrl,
      });
    }

    return { queued: allImages.length };
  }

  async analyzeAndStore(userId: string, projectId: string, imageUrl: string): Promise<void> {
    if (!this.genAI) return;

    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    let imageBase64: string;
    let mimeType = 'image/jpeg';
    try {
      const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return;
      mimeType = res.headers.get('content-type') ?? 'image/jpeg';
      const buf = await res.arrayBuffer();
      imageBase64 = Buffer.from(buf).toString('base64');
      if (imageBase64.length < 100) return; // too small, skip
    } catch {
      return;
    }

    let analysis: VisualAnalysisResult;
    try {
      const result = await model.generateContent([
        {
          text: `Analyze this image for marketing intelligence. Return ONLY valid JSON:
{
  "assetType": "product|lifestyle|team|logo|infographic|banner|background|other",
  "style": "string describing visual style (e.g. premium minimal, bold colorful)",
  "colors": ["hex codes or color names, max 5"],
  "lighting": "studio|natural|dark|bright|unknown",
  "composition": "string (e.g. center focus, rule of thirds, flat lay)",
  "mood": "string (e.g. energetic, calm, professional, playful)",
  "brandingStyle": "string (e.g. luxury, startup, corporate, casual)",
  "useCase": "ads|social|website_hero|product_page|blog|email|other",
  "tags": ["descriptive tags, max 10"],
  "adSuitability": "high|medium|low",
  "suggestedCaption": "1 sentence social caption"
}`,
        },
        { inlineData: { mimeType, data: imageBase64 } },
      ]);

      analysis = this.parseJson(result.response.text()) as VisualAnalysisResult;
    } catch (err) {
      this.logger.warn(`Gemini vision failed for ${imageUrl}: ${err}`);
      return;
    }

    // Store image in R2 for CDN access
    let r2Key = '';
    let r2Url = '';
    try {
      const imgBuf = Buffer.from(imageBase64, 'base64');
      r2Key = `${userId}/${projectId}/images/${Buffer.from(imageUrl).toString('base64url').slice(0, 60)}.jpg`;
      const stored = await this.storage.putObject(r2Key, imgBuf, mimeType, { sourceUrl: imageUrl });
      r2Url = stored.publicUrl;
    } catch {
      r2Key = imageUrl;
      r2Url = imageUrl;
    }

    const asset = await this.prisma.akeAsset.create({
      data: {
        projectId,
        userId,
        r2Key,
        r2Url,
        assetType: 'IMAGE',
        mimeType,
        fileSize: BigInt(Buffer.from(imageBase64, 'base64').length),
        sourceUrl: imageUrl,
        visualAnalysis: analysis as object,
        tags: analysis.tags ?? [],
        status: 'READY',
      },
    }).catch(() => null);

    if (!asset) return;

    // Embed into vector DB for semantic image search
    const description = `${analysis.style} ${analysis.mood} ${analysis.tags.join(' ')} ${analysis.useCase}`;
    await this.vector.upsert(
      VECTOR_COLLECTIONS.AKE_VISUAL,
      asset.id,
      description,
      {
        projectId,
        userId,
        assetId: asset.id,
        style: analysis.style,
        colors: analysis.colors,
        useCase: analysis.useCase,
        tags: analysis.tags,
        analyzedAt: new Date().toISOString(),
      },
    );
  }

  async getAssets(userId: string, projectId: string) {
    return this.prisma.akeAsset.findMany({
      where: { projectId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchByStyle(userId: string, projectId: string, query: string) {
    return this.vector.search(VECTOR_COLLECTIONS.AKE_VISUAL, query, 20, {
      must: [{ key: 'projectId', match: { value: projectId } }],
    });
  }

  private parseJson(text: string): object {
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/({[\s\S]*})/);
      return JSON.parse(match?.[1] ?? text);
    } catch {
      return {};
    }
  }
}
