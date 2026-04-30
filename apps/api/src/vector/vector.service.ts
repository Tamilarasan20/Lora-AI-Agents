import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import {
  VECTOR_COLLECTIONS,
  VECTOR_SIZE,
  VectorCollection,
  VectorPayload,
  VectorSearchResult,
  VectorUpsertItem,
} from './vector.types';

@Injectable()
export class VectorService implements OnModuleInit {
  private readonly logger = new Logger(VectorService.name);
  private qdrant: QdrantClient;
  private openai: OpenAI;
  private embeddingEnabled = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.qdrant = new QdrantClient({
      url: this.config.get<string>('storage.qdrant.url', 'http://localhost:6333'),
      apiKey: this.config.get<string>('storage.qdrant.apiKey') || undefined,
    });

    const openaiKey = this.config.get<string>('OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
      this.embeddingEnabled = true;
    } else {
      this.logger.warn('OPENAI_API_KEY not set — vector embeddings disabled, search will return empty results');
    }

    try {
      await this.ensureCollections();
      this.logger.log('✅ VectorService (Qdrant) initialized');
    } catch (err) {
      this.logger.warn(`Qdrant unavailable at startup — will retry on first use: ${err}`);
    }
  }

  // ── Embedding ─────────────────────────────────────────────────────────────

  async embed(text: string): Promise<number[]> {
    if (!this.embeddingEnabled) return new Array(VECTOR_SIZE).fill(0) as number[];

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8191), // model token limit guard
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.embeddingEnabled) return texts.map(() => new Array(VECTOR_SIZE).fill(0) as number[]);

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts.map((t) => t.slice(0, 8191)),
    });
    return response.data.map((d) => d.embedding);
  }

  // ── Collection management ─────────────────────────────────────────────────

  async ensureCollections(): Promise<void> {
    const existing = await this.qdrant.getCollections();
    const names = new Set(existing.collections.map((c) => c.name));

    const toCreate = Object.values(VECTOR_COLLECTIONS).filter((name) => !names.has(name));

    await Promise.all(
      toCreate.map((name) =>
        this.qdrant.createCollection(name, {
          vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
          optimizers_config: { default_segment_number: 2 },
          replication_factor: 1,
        }),
      ),
    );

    if (toCreate.length > 0) {
      this.logger.log(`Created Qdrant collections: ${toCreate.join(', ')}`);
    }
  }

  // ── Upsert ────────────────────────────────────────────────────────────────

  async upsert(
    collection: VectorCollection,
    id: string,
    text: string,
    payload: VectorPayload,
  ): Promise<void> {
    const vector = await this.embed(text);
    await this.qdrant.upsert(collection, {
      points: [{ id, vector, payload: payload as unknown as Record<string, unknown> }],
    });
  }

  async upsertBatch(collection: VectorCollection, items: VectorUpsertItem[]): Promise<void> {
    if (items.length === 0) return;

    const vectors = await this.embedBatch(items.map((i) => i.text));
    const points = items.map((item, idx) => ({
      id: item.id,
      vector: vectors[idx],
      payload: item.payload as unknown as Record<string, unknown>,
    }));

    // Qdrant recommends batches ≤ 100 points
    const BATCH_SIZE = 100;
    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      await this.qdrant.upsert(collection, { points: points.slice(i, i + BATCH_SIZE) });
    }

    this.logger.debug(`Upserted ${items.length} vectors into ${collection}`);
  }

  // ── Search ────────────────────────────────────────────────────────────────

  async search(
    collection: VectorCollection,
    query: string,
    limit = 10,
    filter?: Record<string, unknown>,
  ): Promise<VectorSearchResult[]> {
    if (!this.embeddingEnabled) return [];

    const vector = await this.embed(query);
    const results = await this.qdrant.search(collection, {
      vector,
      limit,
      with_payload: true,
      filter: filter as any,
    });

    return results.map((r) => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload as unknown as VectorPayload,
    }));
  }

  async searchByVector(
    collection: VectorCollection,
    vector: number[],
    limit = 10,
    filter?: Record<string, unknown>,
  ): Promise<VectorSearchResult[]> {
    const results = await this.qdrant.search(collection, {
      vector,
      limit,
      with_payload: true,
      filter: filter as any,
    });

    return results.map((r) => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload as unknown as VectorPayload,
    }));
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deletePoint(collection: VectorCollection, id: string): Promise<void> {
    await this.qdrant.delete(collection, { points: [id] });
  }

  async deleteByUserId(collection: VectorCollection, userId: string): Promise<void> {
    await this.qdrant.delete(collection, {
      filter: {
        must: [{ key: 'userId', match: { value: userId } }],
      },
    });
  }

  async deleteByFilter(
    collection: VectorCollection,
    filter: Record<string, unknown>,
  ): Promise<void> {
    await this.qdrant.delete(collection, { filter: filter as any });
  }

  // ── Trend relevance scoring ───────────────────────────────────────────────

  async scoreTrendRelevance(
    trendKeywords: string[],
    userId: string,
  ): Promise<{ score: number; matchedContent: VectorSearchResult[] }> {
    if (!this.embeddingEnabled) {
      return { score: 0.5, matchedContent: [] };
    }

    const trendText = trendKeywords.join(' ');
    const results = await this.search(
      VECTOR_COLLECTIONS.BRAND_CONTENT,
      trendText,
      5,
      { must: [{ key: 'userId', match: { value: userId } }] },
    );

    // Average similarity score of top matches
    const score =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.score, 0) / results.length
        : 0;

    return { score: Math.round(score * 100) / 100, matchedContent: results };
  }
}
