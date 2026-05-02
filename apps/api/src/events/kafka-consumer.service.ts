import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka, KafkaMessage, EachMessagePayload } from 'kafkajs';
import { KafkaTopic, LoraEvent } from './event.types';

export type EventHandler = (event: LoraEvent, rawMessage: KafkaMessage) => Promise<void>;

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private kafka: Kafka;
  private consumer: Consumer;
  private dlqProducer: import('kafkajs').Producer;
  private handlers = new Map<KafkaTopic, EventHandler[]>();
  private subscribed = new Set<KafkaTopic>();
  private connected = false;

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService.get<string[]>('kafka.brokers') ?? ['localhost:9092'];
    const clientId = this.configService.get<string>('kafka.clientId', 'loraloop-api');
    const groupId = this.configService.get<string>('kafka.groupId', 'loraloop-api-group');

    this.kafka = new Kafka({ clientId, brokers });
    this.consumer = this.kafka.consumer({ groupId, sessionTimeout: 30000 });
    this.dlqProducer = this.kafka.producer();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.consumer.connect();
      await this.dlqProducer.connect();
      this.connected = true;
      this.logger.log('✅ Kafka consumer connected');
    } catch (error) {
      this.logger.error('Failed to connect Kafka consumer', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected) {
      await this.consumer.disconnect();
      await this.dlqProducer.disconnect();
      this.connected = false;
    }
  }

  registerHandler(topic: KafkaTopic, handler: EventHandler): void {
    const existing = this.handlers.get(topic) ?? [];
    this.handlers.set(topic, [...existing, handler]);
  }

  async subscribe(topic: KafkaTopic): Promise<void> {
    if (!this.connected || this.subscribed.has(topic)) return;
    await this.consumer.subscribe({ topic, fromBeginning: false });
    this.subscribed.add(topic);
    this.logger.log(`Subscribed to Kafka topic: ${topic}`);
  }

  async startConsuming(): Promise<void> {
    if (!this.connected) return;

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    });
  }

  private async handleMessage({ topic, message }: EachMessagePayload): Promise<void> {
    const handlers = this.handlers.get(topic as KafkaTopic);
    if (!handlers?.length) return;

    let event: LoraEvent;
    try {
      event = JSON.parse(message.value?.toString() ?? '{}') as LoraEvent;
    } catch {
      this.logger.error(`Failed to parse message from ${topic}`);
      await this.sendToDlq(topic, message, 'JSON parse error');
      return;
    }

    for (const handler of handlers) {
      try {
        await handler(event, message);
      } catch (error) {
        this.logger.error(`Handler failed for event ${event.eventType} on ${topic}`, error);
        await this.sendToDlq(topic, message, String(error));
      }
    }
  }

  private async sendToDlq(topic: string, message: KafkaMessage, reason: string): Promise<void> {
    const dlqTopic = `${topic}.dlq`;
    try {
      await this.dlqProducer.send({
        topic: dlqTopic,
        messages: [
          {
            key: message.key,
            value: message.value,
            headers: {
              ...message.headers,
              dlqReason: reason,
              dlqTimestamp: new Date().toISOString(),
              originalTopic: topic,
            },
          },
        ],
      });
      this.logger.warn(`Message sent to DLQ: ${dlqTopic}`);
    } catch (dlqError) {
      this.logger.error(`Failed to send message to DLQ: ${dlqTopic}`, dlqError);
    }
  }
}
