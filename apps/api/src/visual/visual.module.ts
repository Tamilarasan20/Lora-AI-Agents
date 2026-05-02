import { Module, OnModuleInit } from '@nestjs/common';
import { VisualService } from './visual.service';
import { VisualController } from './visual.controller';
import { VisualAnalysisProcessor } from './visual-analysis.processor';

@Module({
  controllers: [VisualController],
  providers: [VisualService, VisualAnalysisProcessor],
  exports: [VisualService],
})
export class VisualModule implements OnModuleInit {
  constructor(private readonly processor: VisualAnalysisProcessor) {}

  onModuleInit(): void {
    this.processor.initialize();
  }
}
