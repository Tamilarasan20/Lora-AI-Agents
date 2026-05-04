import { Injectable, Logger, Optional } from '@nestjs/common';
import { Crawl4aiClient, Crawl4aiPageResult } from './crawl4ai-client.service';

// Browser globals inside Playwright page.evaluate() callbacks
declare const window: any;
declare function getComputedStyle(el: any): any;

// ─────────────────────────────────────────────────────────────────────────────
// CrawledBrandData — the normalised result consumed by BrandService
// ─────────────────────────────────────────────────────────────────────────────

export interface CrawledBrandData {
  textByPage:    Record<string, string>; // label → page text (Markdown or raw)
  allText:       string;                 // concatenated, ready for LLM
  imageUrls:     string[];
  logoUrl:       string;
  metaTags:      Record<string, string>;
  reviews:       string[];
  pricing:       string[];
  structuredData: object[];
  pagesVisited:  string[];
  colors:        string[];               // brand colors from CSS vars
}

// ─────────────────────────────────────────────────────────────────────────────
// Page pattern labels — used to categorise nav links for the custom crawler
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_PATTERNS: Record<string, RegExp> = {
  about:    /about|our-story|team|mission|who-we|founders?|story/i,
  products: /product|shop|store|collection|catalog|item|buy/i,
  faq:      /faq|help|support|questions|how-it-works/i,
  blog:     /blog|news|insights|articles?|resources|learn/i,
  contact:  /contact|reach-us|get-in-touch/i,
  reviews:  /review|testimonial|case-stud|success-stor|customer/i,
  press:    /press|media|newsroom|in-the-news/i,
  pricing:  /pric|plan|subscription|tier/i,
};

const PAGE_PRIORITY = ['about', 'products', 'reviews', 'pricing', 'faq', 'blog', 'press', 'contact'];

const USER_AGENT = 'Mozilla/5.0 (compatible; LoraBot/1.0; +https://loraloop.ai/bot)';

// ─────────────────────────────────────────────────────────────────────────────
// BrandCrawlerService — hybrid orchestrator
//
// Strategy:
//   1. Run crawl4ai (deep BFS) + custom Playwright (homepage metadata) in parallel.
//   2. Merge: crawl4ai owns text quality; custom Playwright owns brand metadata
//      (colors, logo, JSON-LD, meta tags, reviews, pricing) that crawl4ai cannot
//      extract without explicit schema configuration.
//   3. Graceful degrade:
//      • crawl4ai unavailable / fails → fall back to custom Playwright entirely
//      • custom Playwright fails      → use crawl4ai text + empty metadata
//
// The allText fed to the LLM comes from crawl4ai's BM25-filtered Markdown when
// available, falling back to the raw innerText assembled by the custom crawler.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class BrandCrawlerService {
  private readonly logger = new Logger(BrandCrawlerService.name);

  constructor(
    @Optional() private readonly crawl4ai: Crawl4aiClient,
  ) {}

  async crawl(websiteUrl: string): Promise<CrawledBrandData> {
    const [c4Result, customResult] = await Promise.allSettled([
      this.runCrawl4ai(websiteUrl),
      this.runCustomPlaywright(websiteUrl),
    ]);

    const c4Data     = c4Result.status     === 'fulfilled' ? c4Result.value     : null;
    const customData = customResult.status === 'fulfilled' ? customResult.value : null;

    if (c4Result.status === 'rejected') {
      this.logger.warn(`Crawl4ai path failed: ${c4Result.reason}`);
    }
    if (customResult.status === 'rejected') {
      this.logger.warn(`Custom Playwright path failed: ${customResult.reason}`);
    }

    // Neither succeeded — return minimal stub
    if (!c4Data && !customData) {
      this.logger.error(`Both crawl paths failed for ${websiteUrl}`);
      return this.emptyCrawl(websiteUrl);
    }

    return this.merge(websiteUrl, c4Data, customData);
  }

  // ── crawl4ai path (deep BFS Markdown) ────────────────────────────────────

  private async runCrawl4ai(
    url: string,
  ): Promise<Pick<CrawledBrandData, 'textByPage' | 'allText' | 'pagesVisited' | 'imageUrls'> | null> {
    if (!this.crawl4ai?.isAvailable) return null;

    const alive = await this.crawl4ai.ping();
    if (!alive) {
      this.logger.warn('Crawl4ai service not reachable — skipping');
      return null;
    }

    const pages = await this.crawl4ai.deepCrawl(url, {
      maxPages:  10,
      maxDepth:  2,
      userQuery: 'brand identity products services tone of voice target audience',
    });

    if (pages.length === 0) return null;

    const textByPage: Record<string, string> = {};
    const pagesVisited: string[]             = [];
    const imageUrls: string[]               = [];

    for (const page of pages) {
      const label = this.labelFromUrl(page.url, url);
      // Prefer BM25-filtered Markdown; fall back to raw
      const md    = page.markdown?.fit_markdown
        || page.markdown?.raw_markdown
        || '';

      if (md.trim()) textByPage[label] = md.slice(0, 6000);
      pagesVisited.push(page.url);

      for (const img of page.media?.images ?? []) {
        if (img.src?.startsWith('http') && !img.src.includes('favicon')) {
          imageUrls.push(img.src);
        }
      }
    }

    const allText = Object.entries(textByPage)
      .map(([label, text]) => `=== ${label.toUpperCase()} ===\n${text}`)
      .join('\n\n');

    this.logger.log(
      `Crawl4ai: ${pages.length} pages crawled, ` +
      `${imageUrls.length} images found for ${url}`,
    );

    return {
      textByPage,
      allText,
      pagesVisited: [...new Set(pagesVisited)],
      imageUrls:    [...new Set(imageUrls)],
    };
  }

  // ── Custom Playwright path (homepage metadata extraction) ─────────────────
  // Homepage-only when running alongside crawl4ai (text handled above).
  // Full multi-page when crawl4ai is unavailable.

  private async runCustomPlaywright(url: string): Promise<CrawledBrandData | null> {
    let chromium: any;
    try {
      chromium = (await import('playwright')).chromium;
    } catch {
      this.logger.warn('Playwright not available');
      return null;
    }

    const crawl4aiActive = this.crawl4ai?.isAvailable ?? false;
    const maxSubPages    = crawl4aiActive ? 0 : 8; // no sub-pages when crawl4ai handles text

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      ignoreHTTPSErrors: true,
    });

    const result: CrawledBrandData = {
      textByPage: {}, allText: '', imageUrls: [], logoUrl: '',
      metaTags: {}, reviews: [], pricing: [], structuredData: [],
      pagesVisited: [], colors: [],
    };

    try {
      // ── Homepage ────────────────────────────────────────────────────────
      const homePage = await context.newPage();
      await homePage.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
      await homePage.waitForTimeout(2000);

      const homeData = await homePage.evaluate(() => {
        const d = (window as any).document;

        const navLinks: string[] = Array.from(
          d.querySelectorAll('nav a[href], header a[href], footer a[href]'),
        )
          .map((a: any) => a.href as string)
          .filter((h: string) => h?.startsWith('http'));

        const logo: string = (
          d.querySelector(
            'img[alt*="logo" i], img[class*="logo" i], img[src*="logo" i], ' +
            'header img:first-child, .logo img, #logo img, [class*="brand"] img',
          ) as any
        )?.src ?? '';

        const meta: Record<string, string> = {};
        (d.querySelectorAll('meta[name], meta[property]') as any[]).forEach((m: any) => {
          const k = m.getAttribute('name') ?? m.getAttribute('property') ?? '';
          const v = m.getAttribute('content') ?? '';
          if (k && v) meta[k] = v;
        });

        const imgs: string[] = Array.from(d.querySelectorAll('img[src]') as any[])
          .map((img: any) => img.src as string)
          .filter((s: string) =>
            s?.startsWith('http') &&
            !s.includes('data:') &&
            !s.includes('icon') &&
            !s.includes('favicon'),
          )
          .filter((s: string, i: number, arr: string[]) => arr.indexOf(s) === i)
          .slice(0, 40);

        const rootStyles = (window as any).getComputedStyle(d.documentElement);
        const cssVars = [
          '--primary', '--accent', '--brand',
          '--color-primary', '--theme-color', '--color-brand',
        ]
          .map((v) => rootStyles.getPropertyValue(v).trim())
          .filter(Boolean);

        const metaTheme = d.querySelector('meta[name="theme-color"]')
          ?.getAttribute('content') ?? '';

        const jsonLd: object[] = Array.from(
          d.querySelectorAll('script[type="application/ld+json"]') as any[],
        )
          .map((s: any) => { try { return JSON.parse(s.textContent); } catch { return null; } })
          .filter(Boolean) as object[];

        const reviewEls = d.querySelectorAll(
          '[class*="review"], [class*="testimonial"], [class*="quote"], blockquote',
        );
        const reviewTexts: string[] = Array.from(reviewEls as any[])
          .map((el: any) => el.innerText?.trim())
          .filter((t: string) => t && t.length > 20)
          .slice(0, 10);

        const pricingEls = d.querySelectorAll(
          '[class*="price"], [class*="plan"], [class*="tier"], [class*="cost"]',
        );
        const pricingTexts: string[] = Array.from(pricingEls as any[])
          .map((el: any) => el.innerText?.trim())
          .filter((t: string) => t && t.length > 5)
          .slice(0, 10);

        const mainEl: any = d.querySelector(
          'main, [role="main"], article, .content, #content, body',
        );
        const text: string = mainEl?.innerText ?? d.body?.innerText ?? '';

        return {
          navLinks, logo, meta, imgs, cssVars, metaTheme,
          jsonLd, reviewTexts, pricingTexts, text,
        };
      });

      result.logoUrl        = homeData.logo;
      result.metaTags       = homeData.meta;
      result.imageUrls.push(...homeData.imgs);
      result.structuredData.push(...homeData.jsonLd);
      result.reviews.push(...homeData.reviewTexts);
      result.pricing.push(...homeData.pricingTexts);
      result.colors         = [
        ...new Set([...homeData.cssVars, homeData.metaTheme].filter(Boolean)),
      ];
      result.textByPage['homepage'] = homeData.text.slice(0, 6000);
      result.pagesVisited.push(url);

      await homePage.close();

      // ── Sub-pages (only when crawl4ai is not handling text) ─────────────
      if (maxSubPages > 0) {
        const categorized = this.categorizeLinks(homeData.navLinks, url);
        const pagesToCrawl = this.selectPages(categorized);

        for (const { label, url: pageUrl } of pagesToCrawl.slice(0, maxSubPages)) {
          if (result.pagesVisited.includes(pageUrl)) continue;
          try {
            const page = await context.newPage();
            await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
            await page.waitForTimeout(1000);

            const pageData = await page.evaluate(() => {
              const d = (window as any).document;
              const mainEl: any = d.querySelector(
                'main, [role="main"], article, .content, body',
              );
              const text: string = mainEl?.innerText ?? '';

              const reviewEls = d.querySelectorAll(
                '[class*="review"], [class*="testimonial"], blockquote, [class*="quote"]',
              );
              const reviews: string[] = Array.from(reviewEls as any[])
                .map((el: any) => el.innerText?.trim())
                .filter((t: string) => t && t.length > 20)
                .slice(0, 8);

              const imgs: string[] = Array.from(
                d.querySelectorAll('main img[src], section img[src]') as any[],
              )
                .map((img: any) => img.src as string)
                .filter((s: string) => s?.startsWith('http') && !s.includes('data:'))
                .slice(0, 10);

              return { text, reviews, imgs };
            });

            result.textByPage[label] = pageData.text.slice(0, 4000);
            result.reviews.push(...pageData.reviews);
            result.imageUrls.push(...pageData.imgs);
            result.pagesVisited.push(pageUrl);

            await page.close();
          } catch (err) {
            this.logger.warn(`Custom crawler failed for ${pageUrl}: ${err}`);
          }
        }
      }
    } finally {
      await browser.close();
    }

    result.imageUrls   = [...new Set(result.imageUrls)];
    result.reviews     = [...new Set(result.reviews)]
      .filter((r) => r.length > 20)
      .slice(0, 30);
    result.allText     = Object.entries(result.textByPage)
      .map(([page, text]) => `=== ${page.toUpperCase()} ===\n${text}`)
      .join('\n\n');

    this.logger.log(
      `Custom crawler: ${result.pagesVisited.length} pages, ` +
      `${result.imageUrls.length} images, ` +
      `${result.reviews.length} reviews`,
    );

    return result;
  }

  // ── Merge ─────────────────────────────────────────────────────────────────

  private merge(
    websiteUrl: string,
    c4: Pick<CrawledBrandData, 'textByPage' | 'allText' | 'pagesVisited' | 'imageUrls'> | null,
    custom: CrawledBrandData | null,
  ): CrawledBrandData {
    // Text: crawl4ai wins (BM25 Markdown) → custom fallback
    const textByPage   = c4?.textByPage   ?? custom?.textByPage   ?? {};
    const allText      = c4?.allText      ?? custom?.allText      ?? '';
    const pagesVisited = [
      ...new Set([...(c4?.pagesVisited ?? []), ...(custom?.pagesVisited ?? [])]),
    ];

    // Images: union of both sources
    const imageUrls = [
      ...new Set([...(c4?.imageUrls ?? []), ...(custom?.imageUrls ?? [])]),
    ].slice(0, 80);

    // Metadata: custom Playwright only
    const logoUrl       = custom?.logoUrl       ?? '';
    const metaTags      = custom?.metaTags      ?? {};
    const structuredData = custom?.structuredData ?? [];
    const reviews       = custom?.reviews       ?? [];
    const pricing       = custom?.pricing       ?? [];
    const colors        = custom?.colors        ?? [];

    const source = c4 && custom ? 'hybrid' : c4 ? 'crawl4ai-only' : 'custom-only';
    this.logger.log(
      `Merge [${source}]: ${pagesVisited.length} pages, ` +
      `${imageUrls.length} images, allText ${allText.length} chars`,
    );

    return {
      textByPage,
      allText,
      imageUrls,
      logoUrl,
      metaTags,
      reviews,
      pricing,
      structuredData,
      pagesVisited,
      colors,
    };
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private labelFromUrl(pageUrl: string, baseUrl: string): string {
    try {
      const path = new URL(pageUrl).pathname.toLowerCase().replace(/\/$/, '') || 'homepage';
      if (path === '' || path === '/') return 'homepage';
      for (const [label, pattern] of Object.entries(PAGE_PATTERNS)) {
        if (pattern.test(path)) return label;
      }
      return path.split('/').filter(Boolean).slice(-1)[0] ?? 'page';
    } catch {
      return 'page';
    }
  }

  private categorizeLinks(
    links: string[],
    baseUrl: string,
  ): Record<string, string[]> {
    const base = new URL(baseUrl).hostname;
    const out: Record<string, string[]> = {};

    for (const link of links) {
      try {
        const u = new URL(link);
        if (u.hostname !== base) continue;
        const path = u.pathname.toLowerCase();
        for (const [category, pattern] of Object.entries(PAGE_PATTERNS)) {
          if (pattern.test(path)) {
            (out[category] ??= []).push(link);
            break;
          }
        }
      } catch { /* invalid URL */ }
    }

    return out;
  }

  private selectPages(
    categorized: Record<string, string[]>,
  ): Array<{ label: string; url: string }> {
    return PAGE_PRIORITY
      .filter((cat) => categorized[cat]?.[0])
      .map((cat) => ({ label: cat, url: categorized[cat][0] }));
  }

  private emptyCrawl(websiteUrl: string): CrawledBrandData {
    return {
      textByPage:    { homepage: `Website: ${websiteUrl}` },
      allText:       `Website: ${websiteUrl}`,
      imageUrls:     [],
      logoUrl:       '',
      metaTags:      {},
      reviews:       [],
      pricing:       [],
      structuredData: [],
      pagesVisited:  [websiteUrl],
      colors:        [],
    };
  }
}
