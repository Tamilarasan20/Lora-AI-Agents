export interface StartCrawlDto {
  projectId: string;
  workspaceId: string;
  websiteUrl: string;
  depth?: number;
}

export interface CrawlPageJob {
  crawlId: string;
  projectId: string;
  userId: string;
  url: string;
  depth: number;
  maxDepth: number;
}

export interface CrawlPageResult {
  url: string;
  title: string;
  html: string;
  textContent: string;
  imageUrls: string[];
  links: string[];
  headings: Array<{ level: number; text: string }>;
  metaTags: Record<string, string>;
  wordCount: number;
  statusCode: number;
}
