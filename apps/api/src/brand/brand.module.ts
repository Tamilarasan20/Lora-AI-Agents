import { Module, forwardRef } from '@nestjs/common';
import { BrandService } from './brand.service';
import { BrandController } from './brand.controller';
import { BrandCrawlerService } from './brand-crawler.service';
import { StorageModule } from '../storage/storage.module';
import { LlmRouterModule } from '../llm-router/llm-router.module';
import { VectorModule } from '../vector/vector.module';
import { BrandIntelligenceService } from './intelligence/brand-intelligence.service';
import { BrandMemoryService } from './intelligence/brand-memory.service';
import { BrandDnaService } from './intelligence/brand-dna.service';
import { CustomerVoiceService } from './intelligence/customer-voice.service';
import { CompetitorIntelligenceService } from './intelligence/competitor-intelligence.service';
import { BrandDriftService } from './intelligence/brand-drift.service';
import { AgentContextService } from './intelligence/agent-context.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    StorageModule,
    LlmRouterModule,
    VectorModule,
    forwardRef(() => QueueModule),
  ],
  controllers: [BrandController],
  providers: [
    BrandCrawlerService,
    BrandService,
    BrandMemoryService,
    BrandDnaService,
    CustomerVoiceService,
    CompetitorIntelligenceService,
    BrandDriftService,
    AgentContextService,
    BrandIntelligenceService,
  ],
  exports: [BrandService, BrandIntelligenceService],
})
export class BrandModule {}
