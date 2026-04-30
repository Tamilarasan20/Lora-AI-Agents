import { ToolDefinition } from '../base-agent';

export function buildMarkTools(): ToolDefinition[] {
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
        // TODO Phase 6: Call platform trend APIs (Twitter Trends, TikTok Discover, etc.)
        return {
          platform: input.platform,
          trends: [],
          fetchedAt: new Date().toISOString(),
          note: 'Stub — real implementation calls platform trend APIs',
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
        // TODO Phase 6: Query TimescaleDB PublishedPost time-series data
        return {
          userId: input.userId,
          platform: input.platform,
          groupBy: input.groupBy ?? 'contentType',
          data: [],
          note: 'Stub — real implementation queries TimescaleDB analytics',
        };
      },
    },
    {
      name: 'search_competitor_content',
      description:
        'Search for public content from competitor accounts to analyze their content strategy.',
      inputSchema: {
        properties: {
          competitorHandles: { type: 'array', items: { type: 'string' } },
          platform: { type: 'string' },
          limit: { type: 'number', description: 'Max posts per competitor (default: 20)' },
        },
        required: ['competitorHandles', 'platform'],
      },
      handler: async (input) => {
        // TODO Phase 6: Use platform public APIs to fetch competitor posts; store in Qdrant for semantic analysis
        return {
          competitors: (input.competitorHandles as string[]).map((handle) => ({
            handle,
            postCount: 0,
            avgEngagementRate: 0,
            topContentThemes: [],
          })),
          note: 'Stub — real implementation scrapes public platform data',
        };
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
        // TODO Phase 7: Query Qdrant vector DB with embedding of input.query
        return {
          query: input.query,
          collection: input.collection,
          results: [],
          note: 'Stub — real implementation uses Qdrant similarity search',
        };
      },
    },
    {
      name: 'calculate_trend_relevance',
      description:
        'Score how relevant a trending topic is to a specific brand based on brand knowledge and historical audience data.',
      inputSchema: {
        properties: {
          trendKeywords: { type: 'array', items: { type: 'string' } },
          brandId: { type: 'string' },
          platform: { type: 'string' },
        },
        required: ['trendKeywords', 'brandId'],
      },
      handler: async (input) => {
        // TODO Phase 7: Load brand knowledge from DB, embed trend keywords, compute cosine similarity against brand content pillars
        return {
          relevanceScore: 0.5,
          relevanceLabel: 'medium',
          reasoning: 'Stub — score based on keyword overlap with brand pillars',
          recommendation: 'Evaluate manually',
          note: 'Stub — real implementation uses Qdrant + BrandKnowledge embedding',
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
        // TODO Phase 6: Aggregate PublishedPost analytics from TimescaleDB
        return {
          period: input.period,
          platforms: input.platforms ?? [],
          summary: {},
          topPosts: [],
          recommendations: [],
          note: 'Stub — real implementation aggregates TimescaleDB data',
        };
      },
    },
  ];
}
