import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaMessage } from 'kafkajs';
import { EventBusService } from '../event-bus.service';
import { EventHandler } from '../kafka-consumer.service';
import { KAFKA_TOPICS, ContentCreatedEvent } from '../event.types';
import { VectorService } from '../../vector/vector.service';
import { VECTOR_COLLECTIONS } from '../../vector/vector.types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContentCreatedHandler implements OnModuleInit {
  private readonly logger = new Logger(ContentCreatedHandler.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly vector: VectorService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.eventBus.on(
      KAFKA_TOPICS.CONTENT_CREATED,
      this.handle.bind(this) as unknown as EventHandler,
    );
  }

  async handle(event: ContentCreatedEvent, _message: KafkaMessage): Promise<void> {
    const { contentId, userId, targetPlatforms } = event.payload;

    this.logger.log(
      `ContentCreated: contentId=${contentId} platforms=${targetPlatforms.join(',')}`,
    );

    // Index each platform variant in Qdrant brand_content collection
    try {
      const content = await this.prisma.content.findUnique({ where: { id: contentId } });
      if (!content) return;

      const platformContent = (content.platformContent ?? {}) as Record<string, any>;

      const items = targetPlatforms.map((platform) => {
        const variant = platformContent[platform] ?? {};
        const caption: string = variant.caption ?? (content.rawContent as any)?.caption ?? '';
        const hashtags: string[] = variant.hashtags ?? content.hashtags ?? [];

        return {
          id: `${contentId}:${platform}`,
          text: `${caption} ${hashtags.join(' ')}`.trim(),
          payload: {
            contentId,
            userId,
            platform,
            caption,
            hashtags,
            status: content.status,
            createdAt: content.createdAt.toISOString(),
          },
        };
      });

      await this.vector.upsertBatch(VECTOR_COLLECTIONS.BRAND_CONTENT, items as any);
      this.logger.debug(`Indexed ${items.length} content variants for ${contentId}`);
    } catch (err) {
      // Non-critical — don't fail the event handler
      this.logger.warn(`Failed to index content ${contentId} in Qdrant: ${err}`);
    }
  }
}
