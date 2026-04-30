import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SyncAudienceAnalyticsProcessor } from './processors/sync-audience-analytics.processor';

/**
 * Triggers a full audience analytics sync across all active platform connections.
 * Runs every 6 hours — keeps Sarah's scheduling data fresh without hammering platform APIs.
 *
 * Schedule breakdown:
 *   0 0,6,12,18 * * *  →  midnight, 6am, noon, 6pm UTC
 */
@Injectable()
export class AudienceSyncScheduler {
  private readonly logger = new Logger(AudienceSyncScheduler.name);

  constructor(private readonly syncProcessor: SyncAudienceAnalyticsProcessor) {}

  @Cron('0 0,6,12,18 * * *')
  async syncAll(): Promise<void> {
    this.logger.log('⏰ Cron triggered: syncing audience analytics for all platforms');
    await this.syncProcessor.enqueueAllConnections();
  }
}
