import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaMessage } from 'kafkajs';
import { EventBusService } from '../event-bus.service';
import { EventHandler } from '../kafka-consumer.service';
import { KAFKA_TOPICS, TrendDetectedEvent } from '../event.types';

@Injectable()
export class TrendDetectedHandler implements OnModuleInit {
  private readonly logger = new Logger(TrendDetectedHandler.name);

  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    this.eventBus.on(KAFKA_TOPICS.TREND_DETECTED, this.handle.bind(this) as unknown as EventHandler);
  }

  async handle(event: TrendDetectedEvent, _message: KafkaMessage): Promise<void> {
    this.logger.log(
      `TrendDetected: keywords=${event.payload.keywords.join(',')} score=${event.payload.trendScore}`,
    );
    // TODO Phase 4: Notify Mark (intelligence agent) to evaluate trend relevance; optionally trigger Clara content brief
  }
}
