import { Controller, Get, Post, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { CreativeService } from './creative.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class GenerateCreativeBodyDto {
  type: 'SOCIAL_MEDIA' | 'SEO' | 'PAID_ADS' | 'EMAIL' | 'CONTENT' | 'VIDEO' | 'COMPETITOR_RESPONSE';
  count?: number;
  platform?: string;
  tone?: string;
  additionalContext?: string;
}

@Controller('v1/projects/:projectId/creatives')
export class CreativeController {
  constructor(private readonly service: CreativeService) {}

  @Post('generate')
  generate(
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: GenerateCreativeBodyDto,
  ) {
    return this.service.generate(userId, projectId, dto);
  }

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('type') type?: string,
  ) {
    return this.service.listStrategies(userId, projectId, type as any);
  }

  @Get(':strategyId')
  get(@CurrentUser('id') userId: string, @Param('strategyId', ParseUUIDPipe) strategyId: string) {
    return this.service.getStrategy(userId, strategyId);
  }

  @Delete(':strategyId')
  delete(@CurrentUser('id') userId: string, @Param('strategyId', ParseUUIDPipe) strategyId: string) {
    return this.service.deleteStrategy(userId, strategyId);
  }
}
