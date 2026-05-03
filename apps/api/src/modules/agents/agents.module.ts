import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { LlmRouterModule } from '../../llm-router/llm-router.module';

@Module({
  imports: [LlmRouterModule],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class Phase1AgentsModule {}
