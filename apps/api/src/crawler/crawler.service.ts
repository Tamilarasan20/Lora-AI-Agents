import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';
import { StartCrawlDto, CrawlPageResult } from './crawler.types';

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async startCrawl(userId: string, dto: StartCrawlDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, userId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const crawl = await this.prisma.crawl.create({
      data: {
        projectId: dto.projectId,
        userId,
        depth: dto.depth ?? project.crawlDepth,
        status: 'PENDING',
      },
    });

    await this.queue.addJob(QUEUE_NAMES.AKE_CRAWL, JOB_NAMES.AKE_CRAWL_PAGE, {
      crawlId: crawl.id,
      projectId: dto.projectId,
      userId,
      url: dto.websiteUrl,
      depth: 0,
      maxDepth: dto.depth ?? project.crawlDepth,
    });

    this.logger.log(`Crawl started: crawlId=${crawl.id} url=${dto.websiteUrl}`);
    return crawl;
  }

  async getCrawlStatus(userId: string, crawlId: string) {
    const crawl = await this.prisma.crawl.findFirst({
      where: { id: crawlId, userId },
      include: { _count: { select: { crawledPages: true } } },
    });
    if (!crawl) throw new NotFoundException('Crawl not found');
    return crawl;
  }

  async listCrawls(userId: string, projectId: string) {
    return this.prisma.crawl.findMany({
      where: { projectId, userId },
      include: { _count: { select: { crawledPages: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async cancelCrawl(userId: string, crawlId: string) {
    const crawl = await this.prisma.crawl.findFirst({ where: { id: crawlId, userId } });
    if (!crawl) throw new NotFoundException('Crawl not found');
    return this.prisma.crawl.update({
      where: { id: crawlId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
  }

  async savePage(crawlId: string, userId: string, projectId: string, result: CrawlPageResult): Promise<string> {
    // Store raw HTML in R2
    const r2Key = `${userId}/${projectId}/${crawlId}/raw/${Buffer.from(result.url).toString('base64url').slice(0, 80)}.html`;
    try {
      await this.storage.putObject(r2Key, Buffer.from(result.html, 'utf8'), 'text/html', {
        sourceUrl: result.url,
        crawlId,
      });
    } catch (err) {
      this.logger.warn(`Failed to store HTML to R2: ${err}`);
    }

    const page = await this.prisma.crawledPage.upsert({
      where: { crawlId_url: { crawlId, url: result.url } },
      create: {
        crawlId,
        projectId,
        userId,
        url: result.url,
        title: result.title,
        htmlR2Key: r2Key,
        textContent: result.textContent.slice(0, 65000),
        imageUrls: result.imageUrls,
        headings: result.headings,
        metaTags: result.metaTags,
        links: result.links,
        wordCount: result.wordCount,
        status: 'DONE',
      },
      update: {
        title: result.title,
        textContent: result.textContent.slice(0, 65000),
        imageUrls: result.imageUrls,
        status: 'DONE',
      },
    });

    await this.prisma.crawl.update({
      where: { id: crawlId },
      data: { pagesProcessed: { increment: 1 } },
    });

    return page.id;
  }

  async markCrawlComplete(crawlId: string) {
    const crawl = await this.prisma.crawl.findUnique({ where: { id: crawlId } });
    if (!crawl) return;
    await this.prisma.crawl.update({
      where: { id: crawlId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    await this.prisma.project.update({
      where: { id: crawl.projectId },
      data: { lastCrawledAt: new Date() },
    });

    // Trigger enrichment pipeline
    await this.queue.addJob(QUEUE_NAMES.AKE_ENRICH, JOB_NAMES.AKE_ENRICH_PROJECT, {
      crawlId,
      projectId: crawl.projectId,
      userId: crawl.userId,
    });

    this.logger.log(`Crawl completed: crawlId=${crawlId}, triggering enrichment`);
  }

  async markCrawlFailed(crawlId: string, error: string) {
    await this.prisma.crawl.update({
      where: { id: crawlId },
      data: { status: 'FAILED', completedAt: new Date(), errorMessage: error },
    });
  }

  async getPagesByCrawl(userId: string, crawlId: string) {
    const crawl = await this.prisma.crawl.findFirst({ where: { id: crawlId, userId } });
    if (!crawl) throw new NotFoundException('Crawl not found');
    return this.prisma.crawledPage.findMany({
      where: { crawlId },
      select: { id: true, url: true, title: true, wordCount: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
