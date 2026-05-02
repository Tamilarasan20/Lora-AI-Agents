import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VectorService } from '../../vector/vector.service';
import { LlmRouterService } from '../../llm-router/llm-router.service';
import { BrandMemoryService } from './brand-memory.service';
import { BrandDnaService } from './brand-dna.service';
import { CustomerVoiceService } from './customer-voice.service';
import { CompetitorIntelligenceService } from './competitor-intelligence.service';
import { BrandDriftService } from './brand-drift.service';
import { AgentContextService, AgentName } from './agent-context.service';
import { Competitor } from '../brand.service';

@Injectable()
export class BrandIntelligenceService {
  private readonly logger = new Logger(BrandIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: BrandMemoryService,
    private readonly dna: BrandDnaService,
    private readonly customerVoice: CustomerVoiceService,
    private readonly competitorIntel: CompetitorIntelligenceService,
    private readonly drift: BrandDriftService,
    private readonly agentContext: AgentContextService,
    @Optional() private readonly vector: VectorService,
    @Optional() private readonly llm: LlmRouterService,
  ) {}

  // ── Full Enrichment Pipeline ───────────────────────────────────────────────

  async fullEnrich(userId: string) {
    this.logger.log(`Starting full intelligence enrichment for user=${userId}`);
    const results: Record<string, any> = {};

    // 1. Extract Brand DNA
    results.dna = await this.dna.extract(userId).catch((err) => {
      this.logger.warn(`DNA extraction failed: ${err}`);
      return null;
    });

    // 2. Analyze all tracked competitors
    const brand = await this.prisma.brandKnowledge.findUnique({ where: { userId } });
    const competitors = (brand?.competitors ?? []) as unknown as Competitor[];
    const competitorResults = [];
    for (const competitor of competitors.slice(0, 5)) {
      const r = await this.competitorIntel.analyzeCompetitor(userId, competitor).catch(() => null);
      if (r) competitorResults.push(r);
    }
    results.competitors = competitorResults;

    // 3. Auto-run drift check from published posts
    results.drift = await this.drift.quickDriftFromPublishedPosts(userId).catch(() => null);

    // 4. Embed enriched profile into vector DB
    if (this.vector && brand) {
      const embeddingText = [
        brand.brandName, brand.valueProposition, brand.targetAudience,
        brand.tone, (brand.voiceCharacteristics as string[]).join(' '),
        (brand.contentPillars as string[]).join(' '),
        results.dna?.archetype, results.dna?.brandPromise,
      ].filter(Boolean).join('. ');

      await this.vector.upsert('brand_knowledge', userId, embeddingText, {
        userId,
        updatedAt: new Date().toISOString(),
      }).catch(() => null);
    }

    this.logger.log(`Full enrichment complete for user=${userId}`);
    return {
      dna: results.dna,
      competitorsAnalyzed: competitorResults.length,
      driftReport: results.drift,
      enrichedAt: new Date().toISOString(),
    };
  }

  // ── Semantic Search ────────────────────────────────────────────────────────

  async search(userId: string, query: string, options: { agentContext?: AgentName; limit?: number } = {}) {
    const limit = options.limit ?? 10;

    if (!this.vector || !this.llm) {
      return this.fallbackSearch(userId, query);
    }

    // Semantic vector search across brand knowledge
    const vectorResults = await this.vector.search('brand_knowledge', query, limit, { userId }).catch(() => []);

    // Also search customer voice
    const voiceResults = await this.vector.search('brand_knowledge', `customer: ${query}`, limit / 2, { userId }).catch(() => []);

    // Rerank and attribute sources
    const attributed = [...vectorResults, ...voiceResults].map((r) => ({
      score: r.score,
      payload: r.payload,
      source: {
        type: 'brand_knowledge',
        excerpt: query,
      },
    }));

    return {
      query,
      results: attributed.slice(0, limit),
      agentContext: options.agentContext ?? 'general',
    };
  }

  private async fallbackSearch(userId: string, query: string) {
    const brand = await this.prisma.brandKnowledge.findUnique({ where: { userId } });
    if (!brand) return { query, results: [] };

    const text = [
      brand.brandName, brand.valueProposition, brand.productDescription,
      brand.targetAudience, brand.tone,
    ].filter(Boolean).join(' ').toLowerCase();

    const queryLower = query.toLowerCase();
    const score = queryLower.split(' ').filter((w) => text.includes(w)).length / queryLower.split(' ').length;

    return {
      query,
      results: score > 0 ? [{ score, payload: { userId, type: 'brand_profile' }, source: { type: 'brand_profile', excerpt: brand.valueProposition } }] : [],
    };
  }

  // ── Getters that delegate ──────────────────────────────────────────────────

  getMemoryHistory = (userId: string, limit?: number) => this.memory.getHistory(userId, limit);
  getPositioningTimeline = (userId: string) => this.memory.getPositioningTimeline(userId);
  getDna = (userId: string) => this.dna.get(userId);
  extractDna = (userId: string) => this.dna.extract(userId);
  getCustomerVoice = (userId: string) => this.customerVoice.getAggregated(userId);
  ingestCustomerVoice = (userId: string, input: Parameters<CustomerVoiceService['ingest']>[1]) => this.customerVoice.ingest(userId, input);
  getCompetitorSnapshots = (userId: string, handle?: string) => this.competitorIntel.getSnapshots(userId, handle);
  analyzeCompetitor = (userId: string, competitor: Competitor, url?: string) => this.competitorIntel.analyzeCompetitor(userId, competitor, url);
  getCompetitiveReport = (userId: string) => this.competitorIntel.getCompetitiveReport(userId);
  analyzeDrift = (userId: string, channels: Parameters<BrandDriftService['analyze']>[1]) => this.drift.analyze(userId, channels);
  getLatestDrift = (userId: string) => this.drift.getLatestReport(userId);
  getDriftHistory = (userId: string) => this.drift.getAllReports(userId);
  getAgentContext = (userId: string, agent: AgentName) => this.agentContext.getContext(userId, agent);
  recordMemory = (...args: Parameters<BrandMemoryService['record']>) => this.memory.record(...args);
  detectChanges = (userId: string, prev: Record<string, unknown>, curr: Record<string, unknown>, source?: string) =>
    this.memory.detectAndRecord(userId, prev, curr, source);
}
