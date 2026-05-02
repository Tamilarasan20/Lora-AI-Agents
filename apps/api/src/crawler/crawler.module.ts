import { Module, OnModuleInit } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { CrawlerController } from './crawler.controller';
import { CrawlPageProcessor } from './processors/crawl-page.processor';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [CrawlerController],
  providers: [CrawlerService, CrawlPageProcessor],
  exports: [CrawlerService],
})
export class CrawlerModule implements OnModuleInit {
  constructor(private readonly crawlPageProcessor: CrawlPageProcessor) {}

  onModuleInit(): void {
    this.crawlPageProcessor.initialize();
  }
}
