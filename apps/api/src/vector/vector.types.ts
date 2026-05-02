export const VECTOR_COLLECTIONS = {
  BRAND_CONTENT: 'brand_content',
  BRAND_KNOWLEDGE: 'brand_knowledge',
  COMPETITOR_CONTENT: 'competitor_content',
  TRENDING_CONTENT: 'trending_content',
} as const;

export type VectorCollection = (typeof VECTOR_COLLECTIONS)[keyof typeof VECTOR_COLLECTIONS];

// Dimensions for OpenAI text-embedding-3-small
export const VECTOR_SIZE = 1536;

// ── Payload types per collection ──────────────────────────────────────────

export interface BrandContentPayload {
  contentId: string;
  userId: string;
  platform: string;
  caption: string;
  hashtags: string[];
  status: string;
  engagementRate?: number;
  impressions?: number;
  publishedAt?: string;
  createdAt: string;
}

export interface CompetitorContentPayload {
  handle: string;
  platform: string;
  caption: string;
  hashtags: string[];
  engagementRate?: number;
  likes?: number;
  comments?: number;
  publishedAt?: string;
  indexedAt: string;
}

export interface TrendingContentPayload {
  keyword: string;
  platform: string;
  trendScore: number;
  category?: string;
  region?: string;
  detectedAt: string;
}

export interface BrandKnowledgePayload {
  userId: string;
  updatedAt: string;
}

export type VectorPayload =
  | BrandContentPayload
  | BrandKnowledgePayload
  | CompetitorContentPayload
  | TrendingContentPayload;

// ── Search result ─────────────────────────────────────────────────────────

export interface VectorSearchResult {
  id: string;
  score: number;
  payload: VectorPayload;
}

// ── Upsert input ──────────────────────────────────────────────────────────

export interface VectorUpsertItem {
  id: string;
  text: string;
  payload: VectorPayload;
}
