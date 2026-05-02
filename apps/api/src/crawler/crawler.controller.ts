import { Controller, Post, Get, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class StartCrawlBodyDto {
  projectId: string;
  workspaceId: string;
  websiteUrl: string;
  depth?: number;
}

@Controller('v1/crawls')
export class CrawlerController {
  constructor(private readonly service: CrawlerService) {}

  @Post()
  start(@CurrentUser('id') userId: string, @Body() dto: StartCrawlBodyDto) {
    return this.service.startCrawl(userId, dto);
  }

  @Get(':crawlId/status')
  status(@CurrentUser('id') userId: string, @Param('crawlId', ParseUUIDPipe) crawlId: string) {
    return this.service.getCrawlStatus(userId, crawlId);
  }

  @Get(':crawlId/pages')
  pages(@CurrentUser('id') userId: string, @Param('crawlId', ParseUUIDPipe) crawlId: string) {
    return this.service.getPagesByCrawl(userId, crawlId);
  }

  @Get('project/:projectId')
  listByProject(@CurrentUser('id') userId: string, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.service.listCrawls(userId, projectId);
  }

  @Delete(':crawlId')
  cancel(@CurrentUser('id') userId: string, @Param('crawlId', ParseUUIDPipe) crawlId: string) {
    return this.service.cancelCrawl(userId, crawlId);
  }
}
