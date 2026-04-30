import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { PluginsModule } from '../plugins/plugins.module';
import { EventsModule } from '../events/events.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PluginsModule, EventsModule, QueueModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
