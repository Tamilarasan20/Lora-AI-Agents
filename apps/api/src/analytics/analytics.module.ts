import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { PlatformAnalyticsService } from './platform-analytics.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionModule } from '../encryption/encryption.module';

@Module({
  imports: [PrismaModule, EncryptionModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, PlatformAnalyticsService],
  exports: [AnalyticsService, PlatformAnalyticsService],
})
export class AnalyticsModule {}
