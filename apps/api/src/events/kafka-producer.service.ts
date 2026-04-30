import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, ProducerRecord, RecordMetadata, CompressionTypes } from 'kafkajs';
import { randomUUID } from 'crypto';
import { BaseEvent, KafkaTopic, LoraEvent } from './event.types';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka: Kafka;
  private producer: Producer;
  private connected = false;

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService.get<string>('kafka.brokers', 'localhost:9092').split(',');
    const clientId = this.configService.get<string>('kafka.clientId', 'loraloop-api');

    this.kafka = new Kafka({
      clientId,
      brokers,
      retry: {
        initialRetryTime: 300,
        retries: 10,
      },
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.connected = true;
      this.logger.log('✅ Kafka producer connected');
    } catch (error) {
      this.logger.error('Failed to connect Kafka producer', error);
    }
  }

  private async disconnect(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
      this.logger.log('Kafka producer disconnected');
    }
  }

  async emit<T extends LoraEvent>(topic: KafkaTopic, event: Omit<T, keyof BaseEvent> & Partial<BaseEvent>): Promise<RecordMetadata[]> {
    const fullEvent: T = {
      eventId: randomUUID(),
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'loraloop-api',
      ...event,
    } as T;

    const record: ProducerRecord = {
      topic,
      compression: CompressionTypes.GZIP,
      messages: [
        {
          key: fullEvent.correlationId ?? fullEvent.eventId,
          value: JSON.stringify(fullEvent),
          headers: {
            eventType: fullEvent.eventType,
            version: fullEvent.version,
            source: fullEvent.source,
          },
        },
      ],
    };

    return this.sendRecord(record);
  }

  async emitBatch(records: { topic: KafkaTopic; event: Partial<LoraEvent> }[]): Promise<RecordMetadata[][]> {
    const results: RecordMetadata[][] = [];
    for (const { topic, event } of records) {
      const metadata = await this.emit(topic, event as Parameters<typeof this.emit>[1]);
      results.push(metadata);
    }
    return results;
  }

  private async sendRecord(record: ProducerRecord): Promise<RecordMetadata[]> {
    if (!this.connected) {
      this.logger.warn(`Kafka not connected — skipping emit to ${record.topic}`);
      return [];
    }
    try {
      const metadata = await this.producer.send(record);
      this.logger.debug(`Event emitted to ${record.topic}`);
      return metadata;
    } catch (error) {
      this.logger.error(`Failed to emit event to ${record.topic}`, error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
