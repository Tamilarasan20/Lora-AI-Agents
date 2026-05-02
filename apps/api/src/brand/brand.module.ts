import { Module } from '@nestjs/common';
import { BrandService } from './brand.service';
import { BrandController } from './brand.controller';
import { StorageModule } from '../storage/storage.module';
import { LlmRouterModule } from '../llm-router/llm-router.module';
import { VectorModule } from '../vector/vector.module';

@Module({
  imports: [StorageModule, LlmRouterModule, VectorModule],
  controllers: [BrandController],
  providers: [BrandService],
  exports: [BrandService],
})
export class BrandModule {}
