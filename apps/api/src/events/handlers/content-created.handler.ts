import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaMessage } from 'kafkajs';
import { EventBusService } from '../event-bus.service';
import { EventHandler } from '../kafka-consumer.service';
import { KAFKA_TOPICS, ContentCreatedEvent } from '../event.types';

@Injectable()
export class ContentCreatedHandler implements OnModuleInit {
  private readonly logger = new Logger(ContentCreatedHandler.name);

  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    this.eventBus.on(KAFKA_TOPICS.CONTENT_CREATED, this.handle.bind(this) as unknown as EventHandler);
  }

  async handle(event: ContentCreatedEvent, _message: KafkaMessage): Promise<void> {
    this.logger.log(
      `ContentCreated: contentId=${event.payload.contentId} platforms=${event.payload.targetPlatforms.join(',')}`,
    );
    // TODO Phase 4: Trigger Clara to adapt content per platform; enqueue ScheduledPosts via BullMQ
  }
}
