import { ToolDefinition } from '../base-agent';
import { VectorService } from '../../vector/vector.service';
import { VECTOR_COLLECTIONS } from '../../vector/vector.types';

export function buildMarkTools(vector: VectorService): ToolDefinition[] {
  return [
    {
      name: 'fetch_trending_topics',
      description:
        'Retrieve currently trending topics and hashtags on a platform, optionally filtered by category or region.',
      inputSchema: {
        properties: {
          platform: { type: 'string' },
          category: { type: 'string', description: 'Industry category filter (e.g. tech, fashion, food)' },
          region: { type: 'string', description: 'ISO 3166-1 alpha-2 country code, e.g. US' },
          limit: { type: 'number' },
        },
        required: ['platform'],
      },
      handler: async (input) => {
        // Fetch from trending_content Qdrant collection
        const trends = await vector.search(
          VECTOR_COLLECTIONS.TRENDING_CONTENT,
          `trending ${input.platform} ${input.category ?? ''} ${input.region ?? ''}`.trim(),
          (input.limit as number) ?? 20,
          input.region
            ? { must: [{ key: 'region', match: { value: input.region } }] }
            : undefined,
        );

        return {
          platform: input.platform,
          trends: trends.map((t) => ({
            keyword: (t.payload as any).keyword,
            score: t.score,
            trendScore: (t.payload as any).trendScore,
            category: (t.payload as any).category,
            detectedAt: (t.payload as any).detectedAt,
          })),
          fetchedAt: new Date().toISOString(),
          resultCount: trends.length,
        };
      },
    },
    {
      name: 'analyze_post_performance',
      description:
        'Analyze the performance of published posts and identify patterns in high vs low performing content.',
      inputSchema: {
        properties: {
          userId: { type: 'string' },
          platform: { type: 'string' },
          dateFrom: { type: 'string', description: 'ISO8601 date' },
          dateTo: { type: 'string', description: 'ISO8601 date' },
          groupBy: {
            type: 'string',
            enum: ['contentType', 'dayOfWeek', 'hourOfDay', 'hashtag', 'postLength'],
          },
        },
        required: ['userId', 'platform'],
      },
      handler: async (input) => {
        // Search brand_content for this user's platform content
        const results = await vector.search(
          VECTOR_COLLECTIONS.BRAND_CONTENT,
          `${input.platform} content performance`,
          50,
          {
            must: [
              { key: 'userId', match: { value: input.userId } },
              { key: 'platform', match: { value: input.platform } },
            ],
          },
        );

        const sorted = results.sort(
          (a, b) =>
            ((b.payload as any).engagementRate ?? 0) - ((a.payload as any).engagementRate ?? 0),
        );

        return {
          userId: input.userId,
          platform: input.platform,
          totalAnalyzed: results.length,
          topPerforming: sorted.slice(0, 5).map((r) => ({
            contentId: (r.payload as any).contentId,
            engagementRate: (r.payload as any).engagementRate,
            impressions: (r.payload as any).impressions,
            publishedAt: (r.payload as any).publishedAt,
          })),
          lowPerforming: sorted.slice(-5).map((r) => ({
            contentId: (r.payload as any).contentId,
            engagementRate: (r.payload as any).engagementRate,
            impressions: (r.payload as any).impressions,
          })),
        };
      },
    },
    {
      name: 'search_competitor_content',
      description:
        'Search for public content from competitor accounts stored in the vector DB to analyze their strategy.',
      inputSchema: {
        properties: {
          competitorHandles: { type: 'array', items: { type: 'string' } },
          platform: { type: 'string' },
          limit: { type: 'number', description: 'Max results per competitor (default: 20)' },
        },
        required: ['competitorHandles', 'platform'],
      },
      handler: async (input) => {
        const handles = input.competitorHandles as string[];
        const limit = (input.limit as number) ?? 20;

        const results = await Promise.all(
          handles.map(async (handle) => {
            const hits = await vector.search(
              VECTOR_COLLECTIONS.COMPETITOR_CONTENT,
              `${handle} ${input.platform} content strategy`,
              limit,
              {
                must: [
                  { key: 'handle', match: { value: handle } },
                  { key: 'platform', match: { value: input.platform } },
                ],
              },
            );

            const payloads = hits.map((h) => h.payload as any);
            const avgEng =
              payloads.length > 0
                ? payloads.reduce((s: number, p: any) => s + (p.engagementRate ?? 0), 0) /
                  payloads.length
                : 0;

            return {
              handle,
              indexedPostCount: payloads.length,
              avgEngagementRate: Math.round(avgEng * 1000) / 1000,
              topThemes: [...new Set(payloads.flatMap((p: any) => p.hashtags ?? []))].slice(0, 10),
            };
          }),
        );

        return { platform: input.platform, competitors: results };
      },
    },
    {
      name: 'vector_search_content',
      description:
        'Semantic search through historical content using Qdrant to find similar posts or identify content gaps.',
      inputSchema: {
        properties: {
          query: { type: 'string', description: 'Natural language search query' },
          userId: { type: 'string' },
          collection: {
            type: 'string',
            enum: ['brand_content', 'competitor_content', 'trending_content'],
          },
          limit: { type: 'number' },
        },
        required: ['query', 'collection'],
      },
      handler: async (input) => {
        const collection = input.collection as keyof typeof VECTOR_COLLECTIONS;
        const collectionName =
          VECTOR_COLLECTIONS[collection] ?? (input.collection as string);

        const filter =
          input.userId
            ? { must: [{ key: 'userId', match: { value: input.userId } }] }
            : undefined;

        const results = await vector.search(
          collectionName as any,
          input.query as string,
          (input.limit as number) ?? 10,
          filter,
        );

        return {
          query: input.query,
          collection: input.collection,
          results: results.map((r) => ({
            id: r.id,
            score: r.score,
            payload: r.payload,
          })),
          totalFound: results.length,
        };
      },
    },
    {
      name: 'calculate_trend_relevance',
      description:
        'Score how relevant a trending topic is to a specific brand by comparing trend embeddings against brand content.',
      inputSchema: {
        properties: {
          trendKeywords: { type: 'array', items: { type: 'string' } },
          userId: { type: 'string' },
          brandId: { type: 'string' },
          platform: { type: 'string' },
        },
        required: ['trendKeywords', 'userId'],
      },
      handler: async (input) => {
        const keywords = input.trendKeywords as string[];
        const { score, matchedContent } = await vector.scoreTrendRelevance(
          keywords,
          input.userId as string,
        );

        const label = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low';
        const shouldEngage = score >= 0.5;

        return {
          relevanceScore: score,
          relevanceLabel: label,
          shouldEngage,
          reasoning: shouldEngage
            ? `Brand content has ${label} semantic similarity (${score}) with trend keywords: ${keywords.join(', ')}`
            : `Low brand-trend alignment (${score}) — engaging may feel inauthentic`,
          matchedContentSamples: matchedContent.slice(0, 3).map((r) => ({
            contentId: (r.payload as any).contentId,
            similarityScore: r.score,
          })),
        };
      },
    },
    {
      name: 'generate_performance_report',
      description:
        'Compile a structured performance report for a brand covering a specified date range.',
      inputSchema: {
        properties: {
          userId: { type: 'string' },
          brandId: { type: 'string' },
          period: { type: 'string', enum: ['week', 'month', 'quarter'] },
          platforms: { type: 'array', items: { type: 'string' } },
        },
        required: ['userId', 'period'],
      },
      handler: async (input) => {
        const platforms = (input.platforms as string[]) ?? [];

        // Aggregate from brand_content collection
        const allResults = await Promise.all(
          platforms.map((p) =>
            vector.search(
              VECTOR_COLLECTIONS.BRAND_CONTENT,
              `${p} performance analytics`,
              100,
              {
                must: [
                  { key: 'userId', match: { value: input.userId } },
                  { key: 'platform', match: { value: p } },
                ],
              },
            ),
          ),
        );

        const byPlatform = platforms.map((p, i) => {
          const posts = allResults[i].map((r) => r.payload as any);
          const avgEng =
            posts.length > 0
              ? posts.reduce((s: number, post: any) => s + (post.engagementRate ?? 0), 0) /
                posts.length
              : 0;
          return {
            platform: p,
            indexedPosts: posts.length,
            avgEngagementRate: Math.round(avgEng * 1000) / 1000,
          };
        });

        return {
          userId: input.userId,
          period: input.period,
          platforms: byPlatform,
          generatedAt: new Date().toISOString(),
        };
      },
    },
  ];
}
