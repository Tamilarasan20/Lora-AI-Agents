import { Module, OnModuleInit } from '@nestjs/common';
import { QueueService } from './queue.service';
import { PublisherService } from './publisher/publisher.service';
import { PublishPostProcessor } from './processors/publish-post.processor';
import { FetchAnalyticsProcessor } from './processors/fetch-analytics.processor';
import { ProcessEngagementProcessor } from './processors/process-engagement.processor';
import { AgentTaskProcessor } from './processors/agent-task.processor';
import { SyncAudienceAnalyticsProcessor } from './processors/sync-audience-analytics.processor';
import { AudienceSyncScheduler } from './audience-sync.scheduler';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [AgentsModule],
  providers: [
    QueueService,
    PublisherService,
    PublishPostProcessor,
    FetchAnalyticsProcessor,
    ProcessEngagementProcessor,
    AgentTaskProcessor,
    SyncAudienceAnalyticsProcessor,
    AudienceSyncScheduler,
  ],
  exports: [QueueService, PublisherService, SyncAudienceAnalyticsProcessor],
})
export class QueueModule implements OnModuleInit {
  constructor(
    private readonly publishPostProcessor: PublishPostProcessor,
    private readonly fetchAnalyticsProcessor: FetchAnalyticsProcessor,
    private readonly processEngagementProcessor: ProcessEngagementProcessor,
    private readonly agentTaskProcessor: AgentTaskProcessor,
    private readonly syncAudienceAnalyticsProcessor: SyncAudienceAnalyticsProcessor,
  ) {}

  onModuleInit(): void {
    this.publishPostProcessor.initialize();
    this.fetchAnalyticsProcessor.initialize();
    this.processEngagementProcessor.initialize();
    this.agentTaskProcessor.initialize();
    this.syncAudienceAnalyticsProcessor.initialize();
  }
}
