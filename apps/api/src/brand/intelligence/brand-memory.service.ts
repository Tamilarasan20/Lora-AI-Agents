import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type ChangeType =
  | 'positioning_shift'
  | 'tone_evolution'
  | 'tagline_change'
  | 'product_evolution'
  | 'audience_shift'
  | 'value_proposition_change'
  | 'competitor_added'
  | 'competitor_removed'
  | 'content_pillar_change'
  | 'voice_characteristic_change';

@Injectable()
export class BrandMemoryService {
  private readonly logger = new Logger(BrandMemoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    userId: string,
    changeType: ChangeType,
    field: string,
    previousValue: string | null,
    currentValue: string | null,
    confidence = 0.9,
    source = 'system',
  ) {
    return this.prisma.brandMemoryEntry.create({
      data: { userId, changeType, field, previousValue, currentValue, confidence, source },
    });
  }

  async getHistory(userId: string, limit = 50) {
    return this.prisma.brandMemoryEntry.findMany({
      where: { userId },
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });
  }

  async detectAndRecord(
    userId: string,
    previousProfile: Record<string, unknown>,
    currentProfile: Record<string, unknown>,
    source = 'website_analysis',
  ) {
    const tracked: Array<{ field: string; changeType: ChangeType }> = [
      { field: 'valueProposition', changeType: 'value_proposition_change' },
      { field: 'tone', changeType: 'tone_evolution' },
      { field: 'targetAudience', changeType: 'audience_shift' },
      { field: 'brandName', changeType: 'tagline_change' },
      { field: 'productDescription', changeType: 'product_evolution' },
    ];

    const recorded = [];
    for (const { field, changeType } of tracked) {
      const prev = previousProfile[field];
      const curr = currentProfile[field];
      if (prev && curr && JSON.stringify(prev) !== JSON.stringify(curr)) {
        const entry = await this.record(
          userId,
          changeType,
          field,
          String(prev).slice(0, 1000),
          String(curr).slice(0, 1000),
          0.85,
          source,
        );
        recorded.push(entry);
      }
    }

    // Track voice characteristic additions/removals
    const prevChars = (previousProfile['voiceCharacteristics'] as string[]) ?? [];
    const currChars = (currentProfile['voiceCharacteristics'] as string[]) ?? [];
    if (JSON.stringify(prevChars.sort()) !== JSON.stringify(currChars.sort())) {
      await this.record(
        userId,
        'voice_characteristic_change',
        'voiceCharacteristics',
        prevChars.join(', '),
        currChars.join(', '),
        0.9,
        source,
      );
    }

    this.logger.log(`Recorded ${recorded.length} brand memory changes for user=${userId}`);
    return recorded;
  }

  async getPositioningTimeline(userId: string) {
    return this.prisma.brandMemoryEntry.findMany({
      where: { userId, changeType: { in: ['positioning_shift', 'value_proposition_change', 'tone_evolution'] } },
      orderBy: { detectedAt: 'asc' },
    });
  }
}
