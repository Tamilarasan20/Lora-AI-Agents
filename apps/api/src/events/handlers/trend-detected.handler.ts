import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaMessage } from 'kafkajs';
import { EventBusService } from '../event-bus.service';
import { EventHandler } from '../kafka-consumer.service';
import { KAFKA_TOPICS, TrendDetectedEvent } from '../event.types';
import { QueueService } from '../../queue/queue.service';
import { JOB_NAMES, QUEUE_NAMES } from '../../queue/queue.constants';

@Injectable()
export class TrendDetectedHandler implements OnModuleInit {
  private readonly logger = new Logger(TrendDetectedHandler.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly queueService: QueueService,
  ) {}

  onModuleInit(): void {
    this.eventBus.on(KAFKA_TOPICS.TREND_DETECTED, this.handle.bind(this) as unknown as EventHandler);
  }

  async handle(event: TrendDetectedEvent, _message: KafkaMessage): Promise<void> {
    this.logger.log(
      `TrendDetected: keywords=${event.payload.keywords.join(',')} score=${event.payload.trendScore}`,
    );

    await this.queueService.addJob(QUEUE_NAMES.AGENT_TASK, JOB_NAMES.MARK_ANALYZE_TRENDS, {
      trendId: event.payload.trendId,
      keywords: event.payload.keywords,
      hashtags: event.payload.hashtags,
      trendScore: event.payload.trendScore,
      platforms: event.payload.platforms,
      category: event.payload.category ?? '',
      detectedAt: event.payload.detectedAt,
      source: event.source,
      userId: event.userId ?? '',
    });
  }
}
