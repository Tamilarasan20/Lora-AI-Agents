import { Controller, Get, Post, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('v1/projects/:projectId/knowledge')
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}

  @Get()
  get(@CurrentUser('id') userId: string, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.service.getKnowledgeBase(userId, projectId);
  }

  @Post('search')
  search(
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body('query') query: string,
  ) {
    return this.service.searchKnowledge(userId, projectId, query);
  }
}
