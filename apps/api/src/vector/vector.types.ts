export const VECTOR_COLLECTIONS = {
  BRAND_CONTENT: 'brand_content',
  BRAND_KNOWLEDGE: 'brand_knowledge',
  COMPETITOR_CONTENT: 'competitor_content',
  TRENDING_CONTENT: 'trending_content',
  // AKE collections
  AKE_KNOWLEDGE: 'ake_knowledge',
  AKE_SEO: 'ake_seo',
  AKE_VISUAL: 'ake_visual',
  AKE_PAGES: 'ake_pages',
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

export interface AkeKnowledgePayload {
  projectId: string;
  userId: string;
  workspaceId: string;
  section: 'business_profile' | 'marketing_strategy' | 'market_research' | 'competitor';
  content: string;
  generatedAt: string;
}

export interface AkeSeoPayload {
  projectId: string;
  userId: string;
  keyword: string;
  intent: string;
  cluster: string;
  volume?: number;
  difficulty?: number;
  generatedAt: string;
}

export interface AkeVisualPayload {
  projectId: string;
  userId: string;
  assetId: string;
  style: string;
  colors: string[];
  useCase: string;
  tags: string[];
  analyzedAt: string;
}

export interface AkePagePayload {
  projectId: string;
  userId: string;
  crawlId: string;
  pageId: string;
  url: string;
  title: string;
  crawledAt: string;
}

export type VectorPayload =
  | BrandContentPayload
  | BrandKnowledgePayload
  | CompetitorContentPayload
  | TrendingContentPayload
  | AkeKnowledgePayload
  | AkeSeoPayload
  | AkeVisualPayload
  | AkePagePayload;

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
