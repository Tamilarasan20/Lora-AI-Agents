import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ─────────────────────────────────────────────────────────────────────────────
// Crawl4aiClient
//
// HTTP wrapper around the crawl4ai Docker service (unclecode/crawl4ai).
// API reference: POST /crawl  →  { results: Crawl4aiPageResult[] }
//
// Deep-crawl request body (v0.6.x schema):
//   {
//     "urls": ["https://example.com"],
//     "config": {
//       "word_count_threshold": 10,
//       "exclude_external_links": true,
//       "deep_crawl_strategy": { "type": "bfs", "max_depth": 2, "max_pages": 10 },
//       "markdown_generator": {
//         "content_filter": { "type": "bm25", "user_query": "..." }
//       }
//     }
//   }
//
// Single-page request omits deep_crawl_strategy.
// ─────────────────────────────────────────────────────────────────────────────

export interface Crawl4aiPageResult {
  url:      string;
  success:  boolean;
  markdown: {
    raw_markdown:           string;
    markdown_with_citations: string;
    fit_markdown:           string; // BM25-filtered
  } | null;
  media: {
    images: Array<{ src: string; alt?: string; score?: number }>;
    videos: Array<{ src: string }>;
  };
  links: {
    internal: Array<{ href: string; text: string }>;
    external: Array<{ href: string; text: string }>;
  };
  metadata: Record<string, string>;
  error?: string;
}

export interface Crawl4aiResponse {
  success: boolean;
  results: Crawl4aiPageResult[];
  error?:  string;
}

export interface Crawl4aiOptions {
  maxPages?:     number;   // default 10; set to 1 for single-page
  maxDepth?:     number;   // BFS depth, default 2
  userQuery?:    string;   // BM25 filter context
  timeoutMs?:    number;   // per-request timeout, default 60 000
}

@Injectable()
export class Crawl4aiClient implements OnModuleInit {
  private readonly logger = new Logger(Crawl4aiClient.name);
  private apiUrl!: string;
  private apiToken!: string;
  private available = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.apiUrl   = this.config.get<string>('CRAWL4AI_API_URL') ?? 'http://localhost:11235';
    this.apiToken = this.config.get<string>('CRAWL4AI_API_TOKEN') ?? '';

    if (!this.apiUrl) {
      this.logger.warn('CRAWL4AI_API_URL not set — crawl4ai integration disabled.');
      return;
    }
    this.available = true;
    this.logger.log(`Crawl4aiClient ready → ${this.apiUrl}`);
  }

  get isAvailable(): boolean { return this.available; }

  // ── Deep crawl (BFS, multiple pages) ─────────────────────────────────────

  async deepCrawl(
    url:  string,
    opts: Crawl4aiOptions = {},
  ): Promise<Crawl4aiPageResult[]> {
    if (!this.available) return [];

    const {
      maxPages  = 10,
      maxDepth  = 2,
      userQuery = 'brand products services tone voice',
      timeoutMs = 90_000,
    } = opts;

    const payload = {
      urls:   [url],
      config: {
        word_count_threshold:    10,
        exclude_external_links:  true,
        deep_crawl_strategy: {
          type:      'bfs',
          max_depth: maxDepth,
          max_pages: maxPages,
        },
        markdown_generator: {
          content_filter: {
            type:       'bm25',
            user_query: userQuery,
          },
        },
        verbose: false,
      },
    };

    return this.post('/crawl', payload, timeoutMs);
  }

  // ── Single-page crawl ─────────────────────────────────────────────────────

  async crawlPage(
    url:  string,
    opts: Pick<Crawl4aiOptions, 'userQuery' | 'timeoutMs'> = {},
  ): Promise<Crawl4aiPageResult | null> {
    if (!this.available) return null;

    const {
      userQuery = 'brand information',
      timeoutMs = 30_000,
    } = opts;

    const payload = {
      urls:   [url],
      config: {
        word_count_threshold:   10,
        exclude_external_links: false,
        markdown_generator: {
          content_filter: { type: 'bm25', user_query: userQuery },
        },
        verbose: false,
      },
    };

    const results = await this.post('/crawl', payload, timeoutMs);
    return results[0] ?? null;
  }

  // ── Health probe (used by BrandCrawlerService before each job) ────────────

  async ping(): Promise<boolean> {
    if (!this.available) return false;
    try {
      const res = await fetch(`${this.apiUrl}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async post(
    path:      string,
    payload:   unknown,
    timeoutMs: number,
  ): Promise<Crawl4aiPageResult[]> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiToken) headers['Authorization'] = `Bearer ${this.apiToken}`;

    let res: Response;
    try {
      res = await fetch(`${this.apiUrl}${path}`, {
        method:  'POST',
        headers,
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      this.logger.warn(`Crawl4ai request to ${path} failed: ${(err as Error).message}`);
      return [];
    }

    if (!res.ok) {
      this.logger.warn(`Crawl4ai ${path} returned ${res.status}`);
      return [];
    }

    let body: Crawl4aiResponse;
    try {
      body = await res.json() as Crawl4aiResponse;
    } catch {
      this.logger.warn('Crawl4ai returned non-JSON response');
      return [];
    }

    if (!body.success || !Array.isArray(body.results)) {
      this.logger.warn(`Crawl4ai error: ${body.error ?? 'unknown'}`);
      return [];
    }

    const ok    = body.results.filter((r) => r.success).length;
    const total = body.results.length;
    this.logger.log(`Crawl4ai: ${ok}/${total} pages successful for ${path}`);

    return body.results.filter((r) => r.success);
  }
}
