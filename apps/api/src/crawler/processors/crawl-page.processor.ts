import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { chromium } from 'playwright';
import { QUEUE_NAMES, JOB_NAMES } from '../../queue/queue.constants';
import { CrawlerService } from '../crawler.service';
import { QueueService } from '../../queue/queue.service';
import { CrawlPageJob, CrawlPageResult } from '../crawler.types';

const USER_AGENT = 'Mozilla/5.0 (compatible; LoraBot/1.0; +https://loraloop.ai/bot)';
const PAGE_TIMEOUT = 20_000;
const NAV_TIMEOUT = 30_000;

@Injectable()
export class CrawlPageProcessor {
  private readonly logger = new Logger(CrawlPageProcessor.name);
  private worker: Worker;
  // Track visited URLs per crawl to avoid re-crawling
  private visited = new Map<string, Set<string>>();

  constructor(
    private readonly crawlerService: CrawlerService,
    private readonly queueService: QueueService,
    private readonly config: ConfigService,
  ) {}

  initialize(): void {
    const connection = {
      host: this.config.get<string>('redis.host', 'localhost'),
      port: this.config.get<number>('redis.port', 6379),
      password: this.config.get<string>('redis.password'),
    };

    this.worker = new Worker(
      QUEUE_NAMES.AKE_CRAWL,
      async (job: Job<CrawlPageJob>) => this.process(job),
      { connection, concurrency: 3 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`CrawlPage job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('✅ CrawlPageProcessor worker started');
  }

  private async process(job: Job<CrawlPageJob>): Promise<void> {
    const { crawlId, projectId, userId, url, depth, maxDepth } = job.data;

    // Deduplication
    if (!this.visited.has(crawlId)) this.visited.set(crawlId, new Set());
    const seen = this.visited.get(crawlId)!;
    if (seen.has(url)) return;
    seen.add(url);

    let result: CrawlPageResult;
    try {
      result = await this.scrapePage(url);
    } catch (err) {
      this.logger.warn(`Failed to scrape ${url}: ${err}`);
      await this.crawlerService.markCrawlFailed(crawlId, `Failed at ${url}: ${err}`);
      return;
    }

    await this.crawlerService.savePage(crawlId, userId, projectId, result);

    // BFS: enqueue discovered links at next depth
    if (depth < maxDepth) {
      const origin = new URL(url).origin;
      const internalLinks = result.links
        .filter((link) => {
          try { return new URL(link).origin === origin; } catch { return false; }
        })
        .filter((link) => !seen.has(link))
        .slice(0, 30); // max 30 links per page

      for (const link of internalLinks) {
        await this.queueService.addJob(QUEUE_NAMES.AKE_CRAWL, JOB_NAMES.AKE_CRAWL_PAGE, {
          crawlId, projectId, userId, url: link,
          depth: depth + 1,
          maxDepth,
        });
      }
    }

    // If this is the seed page (depth=0) or no more jobs pending, check completion
    if (depth === 0) {
      // Kick off completion check after a short delay to let BFS jobs queue
      setTimeout(async () => {
        const crawl = await this.crawlerService.getCrawlStatus(userId, crawlId);
        if (['PENDING', 'RUNNING'].includes(crawl.status)) {
          await this.crawlerService.markCrawlComplete(crawlId);
        }
      }, 15_000);
    }
  }

  private async scrapePage(url: string): Promise<CrawlPageResult> {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();

    try {
      page.setDefaultTimeout(PAGE_TIMEOUT);
      page.setDefaultNavigationTimeout(NAV_TIMEOUT);

      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      const statusCode = response?.status() ?? 0;

      if (statusCode >= 400) {
        throw new Error(`HTTP ${statusCode}`);
      }

      // Wait for main content
      await page.waitForTimeout(1500);

      // page.evaluate runs in browser context — DOM APIs available there, not in Node
      const result = await page.evaluate(() => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const d = (globalThis as any).window.document;
        const getText = (el: any) => el?.textContent?.trim() ?? '';

        const title = (d.title ?? getText(d.querySelector('h1'))) as string;
        const html = d.documentElement.outerHTML as string;

        const mainEl = d.querySelector('main, article, [role="main"], .content, #content, body');
        const textContent = (mainEl?.innerText ?? d.body?.innerText ?? '') as string;

        const imageUrls: string[] = Array.from(d.querySelectorAll('img[src]') as any[])
          .map((img: any) => img.src as string)
          .filter((src: string) => src.startsWith('http') && !src.includes('data:'))
          .filter((src: string, i: number, arr: string[]) => arr.indexOf(src) === i)
          .slice(0, 50);

        const links: string[] = Array.from(d.querySelectorAll('a[href]') as any[])
          .map((a: any) => a.href as string)
          .filter((href: string) => href.startsWith('http'))
          .filter((href: string, i: number, arr: string[]) => arr.indexOf(href) === i)
          .slice(0, 100);

        const headings: Array<{ level: number; text: string }> = Array.from(d.querySelectorAll('h1,h2,h3,h4') as any[])
          .map((h: any) => ({ level: parseInt(h.tagName[1] as string), text: getText(h) as string }))
          .filter((h: any) => h.text.length > 0);

        const metaTags: Record<string, string> = {};
        (d.querySelectorAll('meta[name], meta[property]') as any[]).forEach((meta: any) => {
          const key: string = meta.getAttribute('name') ?? meta.getAttribute('property') ?? '';
          const val: string = meta.getAttribute('content') ?? '';
          if (key && val) metaTags[key] = val;
        });

        const wordCount = textContent.split(/\s+/).filter(Boolean).length;

        return { url: (globalThis as any).window.location.href, title, html, textContent, imageUrls, links, headings, metaTags, wordCount };
      }) as Omit<CrawlPageResult, 'statusCode'>;

      return { ...result, statusCode };
    } finally {
      await browser.close();
    }
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }
}
