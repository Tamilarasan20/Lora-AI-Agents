import { Global, Module } from '@nestjs/common';
import { KafkaProducerService } from './kafka-producer.service';
import { KafkaConsumerService } from './kafka-consumer.service';
import { EventBusService } from './event-bus.service';
import { ContentCreatedHandler } from './handlers/content-created.handler';
import { PostPublishedHandler } from './handlers/post-published.handler';
import { AnalyticsUpdatedHandler } from './handlers/analytics-updated.handler';
import { TrendDetectedHandler } from './handlers/trend-detected.handler';
import { QueueModule } from '../queue/queue.module';

@Global()
@Module({
  imports: [QueueModule],
  providers: [
    KafkaProducerService,
    KafkaConsumerService,
    EventBusService,
    ContentCreatedHandler,
    PostPublishedHandler,
    AnalyticsUpdatedHandler,
    TrendDetectedHandler,
  ],
  exports: [EventBusService, KafkaProducerService, KafkaConsumerService],
})
export class EventsModule {}
