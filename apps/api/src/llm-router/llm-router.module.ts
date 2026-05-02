import { Module, Global } from '@nestjs/common';
import { LlmRouterService } from './llm-router.service';
import { LlmRouterController } from './llm-router.controller';

@Global()
@Module({
  controllers: [LlmRouterController],
  providers: [LlmRouterService],
  exports: [LlmRouterService],
})
export class LlmRouterModule {}
