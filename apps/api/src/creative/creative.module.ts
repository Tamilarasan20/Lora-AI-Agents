import { Module } from '@nestjs/common';
import { CreativeService } from './creative.service';
import { CreativeController } from './creative.controller';

@Module({
  controllers: [CreativeController],
  providers: [CreativeService],
  exports: [CreativeService],
})
export class CreativeModule {}
