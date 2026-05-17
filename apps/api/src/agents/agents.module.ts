import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { ClaraAgent } from './clara/clara.agent';
import { SarahAgent } from './sarah/sarah.agent';
import { SamAgent } from './sam/sam.agent';
import { SophieAgent } from './sophie/sophie.agent';
import { TheoAgent } from './theo/theo.agent';
import { ElenaAgent } from './elena/elena.agent';
import { NickAgent } from './nick/nick.agent';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LlmRouterModule } from '../llm-router/llm-router.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AdsModule } from '../ads/ads.module';
import { VideoGenerationModule } from '../media/video-generation/video-generation.module';

/**
 * Unified AgentsModule — owns every agent in the platform.
 *
 * Two coexisting agent styles (intentional for now):
 *   1. Phase-1 prompt-driven agents dispatched via {@link AgentsService}:
 *      Lora, Sam, Clara, Steve, Sarah. System prompts live next to each agent
 *      directory (e.g. `clara/clara.system-prompt.ts`).
 *   2. BaseAgent-subclass providers: Clara, Sarah, Sam, Sophie, Theo, Elena, Nick.
 *      Each has its own `.agent.ts`, `.prompts.ts`, `.tools.ts` files.
 *
 * SteveService (image-generation orchestrator) is provided by LoraModule
 * because it depends on LoraGateway; including it here would create a
 * circular module dependency.
 */
@Module({
  imports: [NotificationsModule, PrismaModule, LlmRouterModule, AnalyticsModule, AdsModule, VideoGenerationModule],
  providers: [
    AgentsService,
    ClaraAgent,
    SarahAgent,
    SamAgent,
    SophieAgent,
    TheoAgent,
    ElenaAgent,
    NickAgent,
  ],
  exports: [
    AgentsService,
    ClaraAgent,
    SarahAgent,
    SamAgent,
    SophieAgent,
    TheoAgent,
    ElenaAgent,
    NickAgent,
  ],
})
export class AgentsModule {}
