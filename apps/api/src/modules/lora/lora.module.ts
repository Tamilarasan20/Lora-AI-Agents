import { Module, OnModuleInit } from '@nestjs/common';
import { LoraController } from './lora.controller';
import { LoraService } from './lora.service';
import { LoraOrchestrator } from './lora.orchestrator';
import { LoraGateway } from './lora.gateway';
import { Phase1AgentsModule } from '../agents/agents.module';
import { LlmRouterModule } from '../../llm-router/llm-router.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../../storage/storage.module';
import { ImageGenerationModule } from '../image-generation/image-generation.module';
import { QueueModule } from '../../queue/queue.module';
import { SteveService } from '../agents/steve/steve.service';
import { LoraStrategyProcessor } from './processors/lora-strategy.processor';
import { LoraAgentTaskProcessor } from './processors/agent-task.processor';
import { LoraReviewProcessor } from './processors/lora-review.processor';
import { CalendarSyncProcessor } from './processors/calendar-sync.processor';
import { SocialPublishingProcessor } from './processors/social-publishing.processor';

@Module({
  imports: [PrismaModule, LlmRouterModule, Phase1AgentsModule, StorageModule, ImageGenerationModule, QueueModule],
  controllers: [LoraController],
  providers: [
    LoraService,
    LoraOrchestrator,
    LoraGateway,
    SteveService,
    LoraStrategyProcessor,
    LoraAgentTaskProcessor,
    LoraReviewProcessor,
    CalendarSyncProcessor,
    SocialPublishingProcessor,
  ],
  exports: [LoraService, LoraOrchestrator, LoraGateway, SteveService],
})
export class LoraModule implements OnModuleInit {
  constructor(
    private readonly strategyProcessor: LoraStrategyProcessor,
    private readonly agentTaskProcessor: LoraAgentTaskProcessor,
    private readonly reviewProcessor: LoraReviewProcessor,
    private readonly calendarSyncProcessor: CalendarSyncProcessor,
    private readonly socialPublishingProcessor: SocialPublishingProcessor,
  ) {}

  onModuleInit(): void {
    this.strategyProcessor.initialize();
    this.agentTaskProcessor.initialize();
    this.reviewProcessor.initialize();
    this.calendarSyncProcessor.initialize();
    this.socialPublishingProcessor.initialize();
  }
}
