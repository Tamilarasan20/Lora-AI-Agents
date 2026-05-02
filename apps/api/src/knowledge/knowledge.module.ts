import { Module, OnModuleInit } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { EnrichProcessor } from './enrich.processor';
import { SeoModule } from '../seo/seo.module';
import { VisualModule } from '../visual/visual.module';

@Module({
  imports: [SeoModule, VisualModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, EnrichProcessor],
  exports: [KnowledgeService],
})
export class KnowledgeModule implements OnModuleInit {
  constructor(private readonly enrichProcessor: EnrichProcessor) {}

  onModuleInit(): void {
    this.enrichProcessor.initialize();
  }
}
