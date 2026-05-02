import { Controller, Get, Post, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { SeoService } from './seo.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('v1/projects/:projectId/seo')
export class SeoController {
  constructor(private readonly service: SeoService) {}

  @Get()
  get(@CurrentUser('id') userId: string, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.service.getSeoData(userId, projectId);
  }

  @Post('related-keywords')
  related(
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body('seed') seed: string,
  ) {
    return this.service.findRelatedKeywords(userId, projectId, seed);
  }
}
