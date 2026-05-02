import { Injectable, Logger } from '@nestjs/common';

// Browser globals used inside Playwright page.evaluate() callbacks — not available in Node types
declare const window: any;
declare function getComputedStyle(el: any): any;

export interface CrawledBrandData {
  textByPage: Record<string, string>;
  allText: string;
  imageUrls: string[];
  logoUrl: string;
  metaTags: Record<string, string>;
  reviews: string[];
  pricing: string[];
  structuredData: object[];
  pagesVisited: string[];
  colors: string[];
}

const USER_AGENT = 'Mozilla/5.0 (compatible; LoraBot/1.0; +https://loraloop.ai/bot)';

const PAGE_PATTERNS = {
  about:       /about|our-story|team|mission|who-we|founders?|story/i,
  products:    /product|shop|store|collection|catalog|item|buy/i,
  faq:         /faq|help|support|questions|how-it-works/i,
  blog:        /blog|news|insights|articles?|resources|learn/i,
  contact:     /contact|reach-us|get-in-touch/i,
  reviews:     /review|testimonial|case-stud|success-stor|customer/i,
  press:       /press|media|newsroom|in-the-news/i,
  pricing:     /pric|plan|subscription|tier/i,
};

@Injectable()
export class BrandCrawlerService {
  private readonly logger = new Logger(BrandCrawlerService.name);

  async crawl(websiteUrl: string): Promise<CrawledBrandData> {
    let chromium: any;
    try {
      chromium = (await import('playwright')).chromium;
    } catch {
      this.logger.warn('Playwright not available — returning empty crawl');
      return this.emptyCrawl(websiteUrl);
    }

    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const context = await browser.newContext({ userAgent: USER_AGENT, ignoreHTTPSErrors: true });

    const result: CrawledBrandData = {
      textByPage: {}, allText: '', imageUrls: [], logoUrl: '',
      metaTags: {}, reviews: [], pricing: [], structuredData: [], pagesVisited: [], colors: [],
    };

    try {
      // ── Homepage ──────────────────────────────────────────────────────────
      const homePage = await context.newPage();
      await homePage.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await homePage.waitForTimeout(2000);

      const homeData = await homePage.evaluate(() => {
        const d = (window as any).document;

        const navLinks: string[] = Array.from(d.querySelectorAll('nav a[href], header a[href], footer a[href]'))
          .map((a: any) => a.href as string)
          .filter((h: string) => h?.startsWith('http'));

        const logo: string = (
          d.querySelector('img[alt*="logo" i], img[class*="logo" i], img[src*="logo" i], header img:first-child, .logo img, #logo img, [class*="brand"] img') as any
        )?.src ?? '';

        const meta: Record<string, string> = {};
        (d.querySelectorAll('meta[name], meta[property]') as any[]).forEach((m: any) => {
          const k = m.getAttribute('name') ?? m.getAttribute('property') ?? '';
          const v = m.getAttribute('content') ?? '';
          if (k && v) meta[k] = v;
        });

        const imgs: string[] = Array.from(d.querySelectorAll('img[src]') as any[])
          .map((img: any) => img.src as string)
          .filter((s: string) => s?.startsWith('http') && !s.includes('data:') && !s.includes('icon') && !s.includes('favicon'))
          .filter((s: string, i: number, arr: string[]) => arr.indexOf(s) === i)
          .slice(0, 40);

        // Extract brand colors from CSS variables and inline styles
        const rootStyles = (window as any).getComputedStyle(d.documentElement);
        const cssVars = ['--primary', '--accent', '--brand', '--color-primary', '--theme-color']
          .map((v) => rootStyles.getPropertyValue(v).trim())
          .filter(Boolean);

        const metaTheme = d.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? '';

        // Structured data (JSON-LD)
        const jsonLd: object[] = Array.from(d.querySelectorAll('script[type="application/ld+json"]') as any[])
          .map((s: any) => { try { return JSON.parse(s.textContent); } catch { return null; } })
          .filter(Boolean) as object[];

        // Reviews / testimonials on homepage
        const reviewEls = d.querySelectorAll('[class*="review"], [class*="testimonial"], [class*="quote"], blockquote');
        const reviewTexts: string[] = Array.from(reviewEls as any[])
          .map((el: any) => el.innerText?.trim())
          .filter((t: string) => t && t.length > 20)
          .slice(0, 10);

        // Pricing mentions
        const pricingEls = d.querySelectorAll('[class*="price"], [class*="plan"], [class*="tier"], [class*="cost"]');
        const pricingTexts: string[] = Array.from(pricingEls as any[])
          .map((el: any) => el.innerText?.trim())
          .filter((t: string) => t && t.length > 5)
          .slice(0, 10);

        const mainEl: any = d.querySelector('main, [role="main"], article, .content, #content, body');
        const text: string = mainEl?.innerText ?? d.body?.innerText ?? '';

        return { navLinks, logo, meta, imgs, cssVars, metaTheme, jsonLd, reviewTexts, pricingTexts, text };
      });

      result.logoUrl = homeData.logo;
      result.metaTags = homeData.meta;
      result.imageUrls.push(...homeData.imgs);
      result.structuredData.push(...homeData.jsonLd);
      result.reviews.push(...homeData.reviewTexts);
      result.pricing.push(...homeData.pricingTexts);
      result.colors = [...new Set([...homeData.cssVars, homeData.metaTheme].filter(Boolean))];
      result.textByPage['homepage'] = homeData.text.slice(0, 6000);
      result.pagesVisited.push(websiteUrl);

      await homePage.close();

      // ── Categorize and crawl sub-pages ────────────────────────────────────
      const categorized = this.categorizeLinks(homeData.navLinks, websiteUrl);
      const pagesToCrawl = this.selectPages(categorized);

      for (const { label, url } of pagesToCrawl.slice(0, 8)) {
        if (result.pagesVisited.includes(url)) continue;
        try {
          const page = await context.newPage();
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForTimeout(1000);

          const pageData = await page.evaluate(() => {
            const d = (window as any).document;
            const mainEl: any = d.querySelector('main, [role="main"], article, .content, body');
            const text: string = mainEl?.innerText ?? '';

            const reviewEls = d.querySelectorAll('[class*="review"], [class*="testimonial"], blockquote, [class*="quote"]');
            const reviews: string[] = Array.from(reviewEls as any[])
              .map((el: any) => el.innerText?.trim())
              .filter((t: string) => t && t.length > 20)
              .slice(0, 8);

            const imgs: string[] = Array.from(d.querySelectorAll('main img[src], section img[src]') as any[])
              .map((img: any) => img.src as string)
              .filter((s: string) => s?.startsWith('http') && !s.includes('data:'))
              .slice(0, 10);

            return { text, reviews, imgs };
          });

          result.textByPage[label] = pageData.text.slice(0, 4000);
          result.reviews.push(...pageData.reviews);
          result.imageUrls.push(...pageData.imgs);
          result.pagesVisited.push(url);

          await page.close();
        } catch (err) {
          this.logger.warn(`Failed to crawl ${url}: ${err}`);
        }
      }
    } finally {
      await browser.close();
    }

    result.allText = Object.entries(result.textByPage)
      .map(([page, text]) => `=== ${page.toUpperCase()} ===\n${text}`)
      .join('\n\n');

    result.imageUrls = [...new Set(result.imageUrls)];
    result.reviews = [...new Set(result.reviews)].filter((r) => r.length > 20).slice(0, 30);

    this.logger.log(`Crawled ${result.pagesVisited.length} pages, found ${result.imageUrls.length} images, ${result.reviews.length} reviews`);
    return result;
  }

  private categorizeLinks(links: string[], baseUrl: string): Record<string, string[]> {
    const base = new URL(baseUrl).hostname;
    const categorized: Record<string, string[]> = {};

    for (const link of links) {
      try {
        const u = new URL(link);
        if (u.hostname !== base) continue; // stay on same domain
        const path = u.pathname.toLowerCase();

        for (const [category, pattern] of Object.entries(PAGE_PATTERNS)) {
          if (pattern.test(path)) {
            if (!categorized[category]) categorized[category] = [];
            if (!categorized[category].includes(link)) {
              categorized[category].push(link);
            }
            break;
          }
        }
      } catch { /* invalid URL */ }
    }

    return categorized;
  }

  private selectPages(categorized: Record<string, string[]>): Array<{ label: string; url: string }> {
    const priority = ['about', 'products', 'reviews', 'pricing', 'faq', 'blog', 'press', 'contact'];
    const selected: Array<{ label: string; url: string }> = [];

    for (const category of priority) {
      const urls = categorized[category];
      if (urls?.[0]) selected.push({ label: category, url: urls[0] });
    }

    return selected;
  }

  private emptyCrawl(websiteUrl: string): CrawledBrandData {
    return {
      textByPage: { homepage: `Website: ${websiteUrl}` },
      allText: `Website: ${websiteUrl}`,
      imageUrls: [], logoUrl: '', metaTags: {}, reviews: [],
      pricing: [], structuredData: [], pagesVisited: [websiteUrl], colors: [],
    };
  }
}
