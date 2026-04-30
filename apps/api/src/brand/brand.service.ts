import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { KAFKA_TOPICS } from '../events/event.types';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
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
      payload: {
        brandId: userId,
        userId,
        changedFields: Object.keys(dto),
      },
    });

    return updated;
  }

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
