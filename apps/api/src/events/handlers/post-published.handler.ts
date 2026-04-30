import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaMessage } from 'kafkajs';
import { EventBusService } from '../event-bus.service';
import { EventHandler } from '../kafka-consumer.service';
import { KAFKA_TOPICS, PostPublishedEvent } from '../event.types';

@Injectable()
export class PostPublishedHandler implements OnModuleInit {
  private readonly logger = new Logger(PostPublishedHandler.name);

  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    this.eventBus.on(KAFKA_TOPICS.POST_PUBLISHED, this.handle.bind(this) as unknown as EventHandler);
  }

  async handle(event: PostPublishedEvent, _message: KafkaMessage): Promise<void> {
    this.logger.log(
      `PostPublished: publishedPostId=${event.payload.publishedPostId} platform=${event.payload.platform}`,
    );
    // TODO Phase 5: Schedule first analytics fetch (BullMQ delayed job); notify Sarah for engagement monitoring
  }
}
