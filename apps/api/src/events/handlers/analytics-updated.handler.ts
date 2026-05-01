import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaMessage } from 'kafkajs';
import { EventBusService } from '../event-bus.service';
import { EventHandler } from '../kafka-consumer.service';
import { KAFKA_TOPICS, AnalyticsUpdatedEvent } from '../event.types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsUpdatedHandler implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsUpdatedHandler.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.eventBus.on(KAFKA_TOPICS.ANALYTICS_UPDATED, this.handle.bind(this) as unknown as EventHandler);
  }

  async handle(event: AnalyticsUpdatedEvent, _message: KafkaMessage): Promise<void> {
    this.logger.log(
      `AnalyticsUpdated: publishedPostId=${event.payload.publishedPostId} engagementRate=${event.payload.metrics.engagementRate}`,
    );

    const rate = event.payload.metrics.engagementRate ?? 0;
    const performanceTier = rate >= 0.06 ? 'TOP' : rate >= 0.03 ? 'GOOD' : rate >= 0.01 ? 'AVERAGE' : 'LOW';

    await this.prisma.publishedPost.update({
      where: { id: event.payload.publishedPostId },
      data: {
        impressions: event.payload.metrics.impressions,
        reach: event.payload.metrics.reach,
        likes: event.payload.metrics.likes,
        comments: event.payload.metrics.comments,
        shares: event.payload.metrics.shares,
        saves: event.payload.metrics.saves,
        engagementRate: event.payload.metrics.engagementRate,
        clickThroughRate: (event.payload.metrics as any).clickThroughRate,
        performanceTier,
        analyticsLastFetchedAt: new Date(),
      },
    });
  }
}
