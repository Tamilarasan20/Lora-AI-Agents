import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaMessage } from 'kafkajs';
import { EventBusService } from '../event-bus.service';
import { EventHandler } from '../kafka-consumer.service';
import { KAFKA_TOPICS, AnalyticsUpdatedEvent } from '../event.types';

@Injectable()
export class AnalyticsUpdatedHandler implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsUpdatedHandler.name);

  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    this.eventBus.on(KAFKA_TOPICS.ANALYTICS_UPDATED, this.handle.bind(this) as unknown as EventHandler);
  }

  async handle(event: AnalyticsUpdatedEvent, _message: KafkaMessage): Promise<void> {
    this.logger.log(
      `AnalyticsUpdated: publishedPostId=${event.payload.publishedPostId} engagementRate=${event.payload.metrics.engagementRate}`,
    );
    // TODO Phase 6: Persist updated metrics to PublishedPost; update performanceTier; feed Mark's intelligence pipeline
  }
}
