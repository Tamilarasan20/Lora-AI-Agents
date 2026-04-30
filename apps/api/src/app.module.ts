import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

// Foundation
import { PrismaModule } from './prisma/prisma.module';
import { EncryptionModule } from './encryption/encryption.module';

// Phase 3 — Event Bus
import { EventsModule } from './events/events.module';

// Phase 2 — Plugin System
import { PluginsModule } from './plugins/plugins.module';

// Phase 4 — AI Agents
import { AgentsModule } from './agents/agents.module';

// Phase 5 — Queue & Publisher
import { QueueModule } from './queue/queue.module';

// Phase 6 — Feature Modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConnectionsModule } from './connections/connections.module';
import { ContentModule } from './content/content.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { EngagementModule } from './engagement/engagement.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BrandModule } from './brand/brand.module';
import { MediaModule } from './media/media.module';
import { CalendarModule } from './calendar/calendar.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { WebhooksModule } from './webhooks/webhooks.module';

// Guards
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import kafkaConfig from './config/kafka.config';
import storageConfig from './config/storage.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, kafkaConfig, storageConfig],
      envFilePath: ['.env.local', '.env', '../../.env'],
    }),

    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },
      { name: 'medium', ttl: 60000, limit: 500 },
      { name: 'long', ttl: 3600000, limit: 5000 },
    ]),

    ScheduleModule.forRoot(),

    // Phase 1 — Foundation
    PrismaModule,
    EncryptionModule,

    // Phase 3 — Event Bus
    EventsModule,

    // Phase 2 — Plugin System
    PluginsModule,

    // Phase 4 — AI Agents
    AgentsModule,

    // Phase 5 — Queue & Publisher
    QueueModule,

    // Phase 6 — Feature Modules
    AuthModule,
    UsersModule,
    ConnectionsModule,
    ContentModule,
    SchedulerModule,
    EngagementModule,
    AnalyticsModule,
    BrandModule,
    MediaModule,
    CalendarModule,
    NotificationsModule,
    HealthModule,
    WebhooksModule,

    // Phase 7 — Storage & Vector (TODO)
    // StorageModule,
    // VectorModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
