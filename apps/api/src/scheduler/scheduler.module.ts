import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { QueueModule } from '../queue/queue.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [QueueModule, AgentsModule],
  controllers: [SchedulerController],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
