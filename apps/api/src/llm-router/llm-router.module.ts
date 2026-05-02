import { Module, Global } from '@nestjs/common';
import { LlmRouterService } from './llm-router.service';
import { LlmRouterController } from './llm-router.controller';
import { CostTracker } from './cost/cost-tracker';

@Global()
@Module({
  controllers: [LlmRouterController],
  providers: [LlmRouterService, CostTracker],
  exports: [LlmRouterService, CostTracker],
})
export class LlmRouterModule {}
