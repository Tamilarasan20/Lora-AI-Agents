import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { KAFKA_TOPICS } from '../events/event.types';
import { ClaraAgent } from '../agents/clara/clara.agent';
import { CreateContentDto } from './dto/create-content.dto';
import { GenerateContentDto } from './dto/generate-content.dto';
import { QueryContentDto } from './dto/query-content.dto';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly clara: ClaraAgent,
  ) {}

  async create(userId: string, dto: CreateContentDto) {
    // Resolve media assets
    const mediaAssets = dto.mediaAssetIds?.length
      ? await this.prisma.mediaAsset.findMany({
          where: { id: { in: dto.mediaAssetIds }, userId },
          select: { id: true, r2Url: true, mimeType: true, width: true, height: true, fileSizeBytes: true },
        })
      : [];

    const content = await this.prisma.content.create({
      data: {
        userId,
        source: 'USER_UPLOAD',
        contentType: dto.contentType as any,
        rawContent: { caption: dto.caption, cta: dto.cta },
        mediaAssets: mediaAssets,
        targetPlatforms: dto.targetPlatforms,
        tone: dto.tone,
        cta: dto.cta,
        hashtags: dto.hashtags ?? [],
        status: 'DRAFT',
      },
    });

    await this.eventBus.emitContentCreated({
      payload: {
        contentId: content.id,
        userId,
        brandId: userId,
        targetPlatforms: dto.targetPlatforms,
        rawCaption: dto.caption,
        mediaCount: mediaAssets.length,
      },
    });

    return content;
  }

  async generate(userId: string, dto: GenerateContentDto) {
    // Load brand knowledge for context
    const brand = await this.prisma.brandKnowledge.findUnique({ where: { userId } });

    const result = await this.clara.generateContent({
      topic: dto.topic,
      goal: dto.goal as any,
      targetPlatforms: dto.targetPlatforms,
      tone: dto.tone ?? brand?.tone ?? 'professional',
      brandName: brand?.brandName ?? '',
      brandVoice: brand?.voiceCharacteristics?.join(', '),
      prohibitedWords: (brand?.prohibitedWords as string[]) ?? [],
      preferredHashtags: (brand?.preferredHashtags as string[]) ?? [],
      additionalContext: dto.additionalContext,
    });

    // Parse Clara's JSON output into platform-specific content
    let platformContent: Record<string, unknown> = {};
    try {
      const jsonMatch = result.output.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{
          platform: string;
          caption: string;
          hashtags: string[];
          imagePrompt?: string;
        }>;
        platformContent = Object.fromEntries(parsed.map((p) => [p.platform, p]));
      }
    } catch {
      this.logger.warn('Could not parse Clara output as JSON — storing raw');
    }

    // Use first platform's caption as master
    const firstPlatform = Object.values(platformContent)[0] as any;
    const masterCaption = firstPlatform?.caption ?? dto.topic;

    const content = await this.prisma.content.create({
      data: {
        userId,
        source: 'CLARA_AGENT',
        contentType: 'SOCIAL_POST',
        rawContent: { caption: masterCaption, topic: dto.topic, goal: dto.goal },
        mediaAssets: [],
        targetPlatforms: dto.targetPlatforms,
        tone: dto.tone ?? 'professional',
        hashtags: firstPlatform?.hashtags ?? [],
        status: 'PENDING_REVIEW',
        agentProcessed: true,
        agentInsights: { tokensUsed: result.tokensUsed, turns: result.turns },
        platformContent,
      },
    });

    await this.eventBus.emitContentCreated({
      payload: {
        contentId: content.id,
        userId,
        brandId: userId,
        targetPlatforms: dto.targetPlatforms,
        agentId: 'clara',
        rawCaption: masterCaption,
        mediaCount: 0,
      },
    });

    return { content, platformContent, tokensUsed: result.tokensUsed };
  }

  async findAll(userId: string, query: QueryContentDto) {
    const { page = 1, limit = 20, status, platform } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (status) where.status = status;
    if (platform) where.targetPlatforms = { has: platform };

    const [items, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.content.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };
  }

  async findOne(userId: string, id: string) {
    const content = await this.prisma.content.findUnique({ where: { id } });
    if (!content) throw new NotFoundException('Content not found');
    if (content.userId !== userId) throw new ForbiddenException();
    return content;
  }

  async update(userId: string, id: string, data: Partial<CreateContentDto>) {
    await this.findOne(userId, id);
    return this.prisma.content.update({
      where: { id },
      data: {
        ...(data.caption && { rawContent: { caption: data.caption } }),
        ...(data.targetPlatforms && { targetPlatforms: data.targetPlatforms }),
        ...(data.tone && { tone: data.tone }),
        ...(data.hashtags && { hashtags: data.hashtags }),
      },
    });
  }

  async approve(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.content.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.prisma.content.delete({ where: { id } });
  }
}
