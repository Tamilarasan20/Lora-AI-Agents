import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { KAFKA_TOPICS } from '../events/event.types';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { VectorService } from '../vector/vector.service';
import { VECTOR_COLLECTIONS } from '../vector/vector.types';

export interface Competitor {
  id: string;
  platform: string;
  handle: string;
  addedAt: string;
}

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    @Optional() private readonly vector: VectorService,
  ) {}

  async get(userId: string) {
    return this.prisma.brandKnowledge.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async update(userId: string, dto: UpdateBrandDto) {
    const updated = await this.prisma.brandKnowledge.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });

    await this.eventBus.emit(KAFKA_TOPICS.BRAND_KNOWLEDGE_UPDATED, {
      eventType: 'brand.knowledge.updated',
      userId,
      payload: { brandId: userId, userId, changedFields: Object.keys(dto) },
    });

    if (this.vector) {
      const text = [
        dto.brandName,
        dto.brandDescription,
        dto.tone,
        (dto.preferredHashtags as string[] | undefined)?.join(' '),
      ].filter(Boolean).join('. ');
      if (text.trim()) {
        await this.vector
          .upsert(VECTOR_COLLECTIONS.BRAND_KNOWLEDGE, userId, text, {
            userId,
            updatedAt: new Date().toISOString(),
          })
          .catch((err: unknown) => this.logger.warn(`Vector upsert failed: ${err}`));
      }
    }

    return updated;
  }

  // ── Voice ─────────────────────────────────────────────────────────────────

  async getVoice(userId: string) {
    const brand = await this.get(userId);
    return {
      tone: brand.tone,
      voiceCharacteristics: brand.voiceCharacteristics,
      brandDescription: brand.productDescription,
      valueProposition: brand.valueProposition,
      autoReplyEnabled: brand.autoReplyEnabled,
      sentimentThreshold: brand.sentimentThreshold,
    };
  }

  async updateVoice(userId: string, dto: {
    tone?: string;
    voiceCharacteristics?: string[];
    brandDescription?: string;
    valueProposition?: string;
    autoReplyEnabled?: boolean;
    sentimentThreshold?: number;
  }) {
    const data: Record<string, unknown> = {};
    if (dto.tone !== undefined) data.tone = dto.tone;
    if (dto.voiceCharacteristics !== undefined) data.voiceCharacteristics = dto.voiceCharacteristics;
    if (dto.brandDescription !== undefined) data.productDescription = dto.brandDescription;
    if (dto.valueProposition !== undefined) data.valueProposition = dto.valueProposition;
    if (dto.autoReplyEnabled !== undefined) data.autoReplyEnabled = dto.autoReplyEnabled;
    if (dto.sentimentThreshold !== undefined) data.sentimentThreshold = dto.sentimentThreshold;

    return this.prisma.brandKnowledge.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  // ── Competitors ───────────────────────────────────────────────────────────

  async getCompetitors(userId: string): Promise<Competitor[]> {
    const brand = await this.get(userId);
    return (brand.competitors as Competitor[]) ?? [];
  }

  async addCompetitor(userId: string, platform: string, handle: string): Promise<Competitor> {
    const brand = await this.get(userId);
    const existing = (brand.competitors as Competitor[]) ?? [];

    const dupe = existing.find(
      (c) => c.platform === platform && c.handle.toLowerCase() === handle.toLowerCase(),
    );
    if (dupe) return dupe;

    const entry: Competitor = {
      id: crypto.randomUUID(),
      platform,
      handle,
      addedAt: new Date().toISOString(),
    };

    await this.prisma.brandKnowledge.update({
      where: { userId },
      data: { competitors: [...existing, entry] },
    });

    return entry;
  }

  async removeCompetitor(userId: string, competitorId: string): Promise<void> {
    const brand = await this.get(userId);
    const existing = (brand.competitors as Competitor[]) ?? [];
    const filtered = existing.filter((c) => c.id !== competitorId);

    if (filtered.length === existing.length) throw new NotFoundException('Competitor not found');

    await this.prisma.brandKnowledge.update({
      where: { userId },
      data: { competitors: filtered },
    });
  }

  // ── Hashtags / Prohibited ─────────────────────────────────────────────────

  async addHashtags(userId: string, hashtags: string[]) {
    const brand = await this.get(userId);
    const existing = (brand.preferredHashtags as string[]) ?? [];
    const merged = [...new Set([...existing, ...hashtags])];
    return this.prisma.brandKnowledge.update({
      where: { userId },
      data: { preferredHashtags: merged },
    });
  }

  async removeHashtag(userId: string, hashtag: string) {
    const brand = await this.get(userId);
    const updated = ((brand.preferredHashtags as string[]) ?? []).filter((h) => h !== hashtag);
    return this.prisma.brandKnowledge.update({
      where: { userId },
      data: { preferredHashtags: updated },
    });
  }

  async addProhibitedWords(userId: string, words: string[]) {
    const brand = await this.get(userId);
    const existing = (brand.prohibitedWords as string[]) ?? [];
    const merged = [...new Set([...existing, ...words.map((w) => w.toLowerCase())])];
    return this.prisma.brandKnowledge.update({
      where: { userId },
      data: { prohibitedWords: merged },
    });
  }
}
