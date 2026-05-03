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
        const toAbsoluteUrl = (raw: string | null | undefined) => {
          if (!raw) return '';
          try { return new URL(raw, d.baseURI).toString(); } catch { return ''; }
        };
        const collectSrcSetUrls = (srcset: string | null | undefined) =>
          (srcset ?? '')
            .split(',')
            .map((part) => toAbsoluteUrl(part.trim().split(/\s+/)[0]))
            .filter(Boolean);

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

        const imageCandidates = new Set<string>();
        const pushImage = (value: string | null | undefined) => {
          const absolute = toAbsoluteUrl(value);
          if (!absolute || absolute.startsWith('data:') || /icon|favicon/i.test(absolute)) return;
          imageCandidates.add(absolute);
        };

        Array.from(d.querySelectorAll('img, source') as any[]).forEach((el: any) => {
          pushImage(el.currentSrc);
          pushImage(el.src);
          pushImage(el.getAttribute?.('data-src'));
          pushImage(el.getAttribute?.('data-lazy-src'));
          pushImage(el.getAttribute?.('data-original'));
          collectSrcSetUrls(el.srcset).forEach(pushImage);
          collectSrcSetUrls(el.getAttribute?.('data-srcset')).forEach(pushImage);
        });

        ['og:image', 'twitter:image', 'twitter:image:src'].forEach((key) => pushImage(meta[key]));

        const backgroundUrls: string[] = [];
        Array.from(d.querySelectorAll('section, div, figure, a') as any[]).slice(0, 120).forEach((el: any) => {
          const bg = getComputedStyle(el).backgroundImage ?? '';
          const matches = [...bg.matchAll(/url\((['"]?)(.*?)\1\)/g)];
          matches.forEach((match) => backgroundUrls.push(match[2]));
        });
        backgroundUrls.forEach(pushImage);

        const ldImages: string[] = [];
        const collectJsonLdImages = (value: any) => {
          if (!value) return;
          if (typeof value === 'string') {
            pushImage(value);
            ldImages.push(value);
            return;
          }
          if (Array.isArray(value)) {
            value.forEach(collectJsonLdImages);
            return;
          }
          if (typeof value === 'object') {
            if ((value as any).image) collectJsonLdImages((value as any).image);
            Object.values(value).forEach(collectJsonLdImages);
          }
        };

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
        jsonLd.forEach(collectJsonLdImages);

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

        const imgs = Array.from(imageCandidates).slice(0, 60);
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
            const toAbsoluteUrl = (raw: string | null | undefined) => {
              if (!raw) return '';
              try { return new URL(raw, d.baseURI).toString(); } catch { return ''; }
            };
            const collectSrcSetUrls = (srcset: string | null | undefined) =>
              (srcset ?? '')
                .split(',')
                .map((part) => toAbsoluteUrl(part.trim().split(/\s+/)[0]))
                .filter(Boolean);
            const mainEl: any = d.querySelector('main, [role="main"], article, .content, body');
            const text: string = mainEl?.innerText ?? '';

            const reviewEls = d.querySelectorAll('[class*="review"], [class*="testimonial"], blockquote, [class*="quote"]');
            const reviews: string[] = Array.from(reviewEls as any[])
              .map((el: any) => el.innerText?.trim())
              .filter((t: string) => t && t.length > 20)
              .slice(0, 8);

            const imageCandidates = new Set<string>();
            const pushImage = (value: string | null | undefined) => {
              const absolute = toAbsoluteUrl(value);
              if (!absolute || absolute.startsWith('data:') || /icon|favicon/i.test(absolute)) return;
              imageCandidates.add(absolute);
            };

            Array.from(d.querySelectorAll('main img, main source, section img, section source, picture img') as any[]).forEach((img: any) => {
              pushImage(img.currentSrc);
              pushImage(img.src);
              pushImage(img.getAttribute?.('data-src'));
              pushImage(img.getAttribute?.('data-lazy-src'));
              collectSrcSetUrls(img.srcset).forEach(pushImage);
              collectSrcSetUrls(img.getAttribute?.('data-srcset')).forEach(pushImage);
            });

            const imgs = Array.from(imageCandidates).slice(0, 16);

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

      const staticImages = await this.collectStaticImageCandidates(result.pagesVisited);
      const ecommerceImages = await this.scrapeEcommerceApis(new URL(websiteUrl).origin);
      result.imageUrls.push(...staticImages, ...ecommerceImages);
    } finally {
      await browser.close();
    }

    result.allText = Object.entries(result.textByPage)
      .map(([page, text]) => `=== ${page.toUpperCase()} ===\n${text}`)
      .join('\n\n');

    result.imageUrls = this.finalizeReferenceImages(result.logoUrl, result.imageUrls);
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

  private async collectStaticImageCandidates(pageUrls: string[]) {
    const images: string[] = [];
    await Promise.all(pageUrls.slice(0, 8).map(async (url) => {
      try {
        const response = await fetch(url, {
          headers: {
            'user-agent': USER_AGENT,
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(7000),
        });
        if (!response.ok) return;
        const html = await response.text();
        images.push(...this.collectImagesFromHtml(html, url));
      } catch { /* best effort */ }
    }));
    return images;
  }

  private async scrapeEcommerceApis(origin: string) {
    const images: string[] = [];
    const headers = { 'user-agent': USER_AGENT };
    const pushImage = (value?: string | null) => {
      if (value && this.isUsefulImage(value)) images.push(value);
    };

    try {
      const response = await fetch(`${origin}/products.json?limit=250`, {
        headers,
        signal: AbortSignal.timeout(7000),
      });
      if (response.ok) {
        const data = await response.json() as any;
        for (const product of (data.products ?? []).slice(0, 100)) {
          for (const image of product.images ?? []) pushImage(image.src);
          for (const variant of product.variants ?? []) pushImage(variant.featured_image?.src);
        }
      }
    } catch { /* not Shopify */ }

    try {
      const response = await fetch(`${origin}/collections.json?limit=80`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json() as any;
        for (const collection of data.collections ?? []) pushImage(collection.image?.src);
      }
    } catch { /* not Shopify */ }

    try {
      const response = await fetch(`${origin}/wp-json/wp/v2/media?per_page=80&media_type=image&_fields=source_url,media_details`, {
        headers,
        signal: AbortSignal.timeout(7000),
      });
      if (response.ok) {
        const media = await response.json() as any[];
        for (const item of media ?? []) {
          pushImage(item.source_url);
          for (const size of Object.values(item.media_details?.sizes ?? {}) as Array<{ source_url?: string }>) {
            pushImage(size.source_url);
          }
        }
      }
    } catch { /* not WordPress */ }

    return images;
  }

  private collectImagesFromHtml(html: string, baseUrl: string) {
    const results = new Set<string>();

    const patterns = [
      /<meta[^>]+property=["']og:image(?::(?:secure_url|url))?["'][^>]+content=["']([^"']+)["']/gi,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/gi,
      /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/gi,
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/gi,
      /<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]+href=["']([^"']+)["']/gi,
      /<video[^>]+poster=["']([^"']+)["']/gi,
      /<a[^>]+href=["']([^"']+\.(?:png|jpe?g|webp|avif|gif|svg)(?:\?[^"']*)?)["']/gi,
      /url\(["']?(https?:\/\/[^"')]+)["']?\)/gi,
    ];

    for (const pattern of patterns) {
      for (const match of html.matchAll(pattern)) {
        this.addImageCandidate(results, match[1] ?? '', baseUrl);
      }
    }

    for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
      for (const value of this.extractAttrValues(tag, [
        'src',
        'data-src',
        'data-lazy-src',
        'data-original',
        'data-lazy',
        'data-image',
        'data-bg',
        'data-full',
        'data-hi-res',
        'data-large-file',
        'data-orig-file',
        'data-full-url',
        'data-zoom-src',
        'srcset',
        'data-srcset',
      ])) {
        this.addImageCandidate(results, value, baseUrl);
      }
    }

    for (const tag of html.match(/<source\b[^>]*>/gi) ?? []) {
      for (const value of this.extractAttrValues(tag, ['srcset', 'data-srcset'])) {
        this.addImageCandidate(results, value, baseUrl);
      }
    }

    for (const noscript of html.matchAll(/<noscript>([\s\S]*?)<\/noscript>/gi)) {
      for (const match of (noscript[1] ?? '').matchAll(/(?:src|data-src|data-lazy-src|srcset)=["']([^"']+)["']/gi)) {
        this.addImageCandidate(results, match[1] ?? '', baseUrl);
      }
    }

    this.parseJsonLdImages(html, baseUrl).forEach((image) => results.add(image));
    return Array.from(results);
  }

  private parseJsonLdImages(html: string, baseUrl: string) {
    const results = new Set<string>();
    const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    const walk = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (typeof nested === 'string' && ['image', 'url', 'contentUrl', 'thumbnailUrl', 'photo', 'logo'].includes(key)) {
          this.addImageCandidate(results, nested, baseUrl);
        } else if (nested && typeof nested === 'object') {
          walk(nested);
        }
      }
    };

    for (const match of scripts) {
      try { walk(JSON.parse(match[1])); } catch { /* invalid JSON-LD */ }
    }

    return Array.from(results);
  }

  private extractAttrValues(tag: string, attrs: string[]) {
    return attrs
      .map((attr) => tag.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'))?.[1] ?? '')
      .filter(Boolean);
  }

  private addImageCandidate(results: Set<string>, candidate: string, baseUrl: string) {
    if (!candidate) return;
    const decoded = this.decodeHtmlEntities(candidate);
    const entries = decoded.includes(',') && /\s+\d+(\.\d+)?[wx]/.test(decoded)
      ? decoded.split(',').map((entry) => entry.trim().split(/\s+/)[0] ?? '')
      : [decoded];

    for (const entry of entries) {
      const absolute = this.toAbsoluteUrl(baseUrl, entry);
      if (absolute && this.isUsefulImage(absolute)) results.add(absolute);
    }
  }

  private finalizeReferenceImages(logoUrl: string, images: string[]) {
    const scored = new Map<string, { url: string; score: number }>();

    for (const image of images) {
      if (!this.isUsefulImage(image)) continue;
      const normalized = this.normalizeImageUrl(image);
      if (logoUrl && this.normalizeImageUrl(logoUrl) === normalized) continue;
      const score = this.scoreImage(image);
      const existing = scored.get(normalized);
      if (!existing || existing.score < score) {
        scored.set(normalized, { url: image, score });
      }
    }

    return Array.from(scored.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((entry) => entry.url);
  }

  private isUsefulImage(src: string) {
    if (!src || src.length < 10) return false;
    if (/\s+\d+(\.\d+)?[wx]/.test(src)) return false;
    if (/,\s*https?:\/\//.test(src)) return false;
    if (src.includes(' ')) return false;

    const lower = src.toLowerCase();
    const hardReject = [
      'pixel', 'track', 'analytics', 'beacon', '1x1', 'spacer',
      'facebook.com/tr', 'google-analytics', 'doubleclick', 'googletagmanager',
      'hotjar', 'data:image/gif', 'data:image/svg+xml', 'gravatar', 'wp-emoji',
      'spinner', 'loading.gif', 'captcha', 'cloudflare',
    ];
    if (hardReject.some((entry) => lower.includes(entry))) return false;
    if (lower.endsWith('.ico')) return false;
    if (/\/(favicon|sprite)\b/i.test(lower)) return false;
    if (/\/(icon|arrow|chevron|check|star|dot|close|menu|hamburger|button|btn)\//i.test(lower)) return false;
    return /\.(jpg|jpeg|png|webp|avif|gif|svg)(\?|$)/i.test(lower) || lower.startsWith('http');
  }

  private normalizeImageUrl(src: string) {
    try {
      const url = new URL(src);
      ['w', 'h', 'width', 'height', 'size', 'q', 'quality', 'fit', 'resize', 'scale', 'format', 'auto', 'fm', 'crop', 'dpr'].forEach((param) => {
        url.searchParams.delete(param);
      });
      url.pathname = url.pathname
        .replace(/-\d+x\d+(\.[a-zA-Z]+)$/, '$1')
        .replace(/_\d+x\d+(\.[a-zA-Z]+)$/, '$1')
        .replace(/@[0-9.]+x(\.[a-zA-Z]+)$/, '$1');
      return `${url.origin}${url.pathname}`;
    } catch {
      return src;
    }
  }

  private scoreImage(url: string) {
    const lower = url.toLowerCase();
    let score = 0;
    const widthQuery = url.match(/[?&](?:w|width|imwidth|imageWidth)=(\d+)/i);
    if (widthQuery) {
      const width = Number(widthQuery[1]);
      if (width >= 1600) score += 35;
      else if (width >= 1200) score += 25;
      else if (width >= 800) score += 15;
      else if (width < 200) score -= 25;
    }
    if (/\/(product|hero|banner|feature|gallery|campaign|lifestyle|collection|look|editorial|showcase)/i.test(lower)) score += 20;
    if (/\/(about|brand|identity|team|story|culture|history)/i.test(lower)) score += 12;
    if (/og[_-]?image|social[_-]?share|opengraph/i.test(lower)) score += 25;
    if (/thumbnail|thumb|\bsmall\b|\bmini\b|[_-]sm[_-]|[_-]xs[_-]|\bpreview\b/i.test(lower)) score -= 25;
    if (/icon|sprite|arrow|check|star|dot|close|menu|placeholder/i.test(lower)) score -= 30;
    return score;
  }

  private toAbsoluteUrl(baseUrl: string, value?: string | null) {
    if (!value) return '';
    try { return new URL(value.replace(/^['"]|['"]$/g, ''), baseUrl).toString(); } catch { return ''; }
  }

  private decodeHtmlEntities(value: string) {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
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
