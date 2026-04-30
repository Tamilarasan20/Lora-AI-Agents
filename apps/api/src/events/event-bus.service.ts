import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RecordMetadata } from 'kafkajs';
import { KafkaProducerService } from './kafka-producer.service';
import { KafkaConsumerService, EventHandler } from './kafka-consumer.service';
import {
  KAFKA_TOPICS,
  KafkaTopic,
  LoraEvent,
  BaseEvent,
  ContentCreatedEvent,
  PostPublishedEvent,
  AnalyticsUpdatedEvent,
  TrendDetectedEvent,
  EngagementReceivedEvent,
} from './event.types';

@Injectable()
export class EventBusService implements OnModuleInit {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly producer: KafkaProducerService,
    private readonly consumer: KafkaConsumerService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Subscribe to topics handled by built-in handlers
    const topicsToSubscribe: KafkaTopic[] = [
      KAFKA_TOPICS.CONTENT_CREATED,
      KAFKA_TOPICS.POST_PUBLISHED,
      KAFKA_TOPICS.ANALYTICS_UPDATED,
      KAFKA_TOPICS.TREND_DETECTED,
      KAFKA_TOPICS.ENGAGEMENT_RECEIVED,
    ];

    for (const topic of topicsToSubscribe) {
      await this.consumer.subscribe(topic);
    }

    await this.consumer.startConsuming();
    this.logger.log('✅ EventBusService ready');
  }

  // ── Emit helpers ────────────────────────────────────────────────────────────

  async emitContentCreated(
    payload: Omit<ContentCreatedEvent, keyof BaseEvent>,
  ): Promise<RecordMetadata[]> {
    return this.producer.emit(KAFKA_TOPICS.CONTENT_CREATED, payload);
  }

  async emitPostPublished(
    payload: Omit<PostPublishedEvent, keyof BaseEvent>,
  ): Promise<RecordMetadata[]> {
    return this.producer.emit(KAFKA_TOPICS.POST_PUBLISHED, payload);
  }

  async emitAnalyticsUpdated(
    payload: Omit<AnalyticsUpdatedEvent, keyof BaseEvent>,
  ): Promise<RecordMetadata[]> {
    return this.producer.emit(KAFKA_TOPICS.ANALYTICS_UPDATED, payload);
  }

  async emitTrendDetected(
    payload: Omit<TrendDetectedEvent, keyof BaseEvent>,
  ): Promise<RecordMetadata[]> {
    return this.producer.emit(KAFKA_TOPICS.TREND_DETECTED, payload);
  }

  async emitEngagementReceived(
    payload: Omit<EngagementReceivedEvent, keyof BaseEvent>,
  ): Promise<RecordMetadata[]> {
    return this.producer.emit(KAFKA_TOPICS.ENGAGEMENT_RECEIVED, payload);
  }

  async emit<T extends LoraEvent>(
    topic: KafkaTopic,
    payload: Omit<T, keyof BaseEvent> & Partial<BaseEvent>,
  ): Promise<RecordMetadata[]> {
    return this.producer.emit<T>(topic, payload);
  }

  // ── Handler registration ─────────────────────────────────────────────────

  on(topic: KafkaTopic, handler: EventHandler): void {
    this.consumer.registerHandler(topic, handler);
  }
}
