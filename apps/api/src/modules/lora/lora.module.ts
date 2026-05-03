import { Module } from '@nestjs/common';
import { LoraController } from './lora.controller';
import { LoraService } from './lora.service';
import { LoraOrchestrator } from './lora.orchestrator';
import { LoraGateway } from './lora.gateway';
import { Phase1AgentsModule } from '../agents/agents.module';
import { LlmRouterModule } from '../../llm-router/llm-router.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, LlmRouterModule, Phase1AgentsModule],
  controllers: [LoraController],
  providers: [LoraService, LoraOrchestrator, LoraGateway],
  exports: [LoraService, LoraOrchestrator, LoraGateway],
})
export class LoraModule {}
