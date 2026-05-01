import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaMessage } from 'kafkajs';
import { EventBusService } from '../event-bus.service';
import { EventHandler } from '../kafka-consumer.service';
import { KAFKA_TOPICS, PostPublishedEvent } from '../event.types';
import { QueueService } from '../../queue/queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, JOB_NAMES } from '../../queue/queue.constants';

@Injectable()
export class PostPublishedHandler implements OnModuleInit {
  private readonly logger = new Logger(PostPublishedHandler.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly queue: QueueService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.eventBus.on(KAFKA_TOPICS.POST_PUBLISHED, this.handle.bind(this) as unknown as EventHandler);
  }

  async handle(event: PostPublishedEvent, _message: KafkaMessage): Promise<void> {
    this.logger.log(
      `PostPublished: publishedPostId=${event.payload.publishedPostId} platform=${event.payload.platform}`,
    );

    await this.queue.addJob(
      QUEUE_NAMES.FETCH_ANALYTICS,
      JOB_NAMES.FETCH_POST_ANALYTICS,
      { publishedPostId: event.payload.publishedPostId, platform: event.payload.platform, userId: event.payload.userId },
      { delay: 1_800_000 }, // 30 min
    );
  }
}
