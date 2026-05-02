import { Controller, Get, Post, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { VisualService } from './visual.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('v1/projects/:projectId/visual')
export class VisualController {
  constructor(private readonly service: VisualService) {}

  @Get('assets')
  getAssets(@CurrentUser('id') userId: string, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.service.getAssets(userId, projectId);
  }

  @Post('search')
  search(
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body('query') query: string,
  ) {
    return this.service.searchByStyle(userId, projectId, query);
  }
}
