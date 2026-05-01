import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  publishedPost: {
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  // $queryRaw is called as a tagged template, which evaluates nested expressions first.
  // The nested $queryRaw call (for the platform clause) consumes the first mock return,
  // so we use mockResolvedValue (persistent) rather than mockResolvedValueOnce.
  $queryRaw: jest.fn().mockResolvedValue([]),
};

const USER_ID = 'user-1';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('getOverview', () => {
    it('returns overview with zero defaults when no data', async () => {
      mockPrisma.publishedPost.count.mockResolvedValueOnce(0);
      mockPrisma.publishedPost.aggregate.mockResolvedValueOnce({
        _sum: { impressions: null, reach: null, likes: null, comments: null, shares: null, saves: null, clicks: null, videoViews: null },
        _avg: { engagementRate: null },
      });
      mockPrisma.publishedPost.groupBy.mockResolvedValueOnce([]);

      const result = await service.getOverview(USER_ID);

      expect(result).toHaveProperty('totalPosts', 0);
      expect(result).toHaveProperty('avgEngagementRate');
      expect(result).toHaveProperty('totals');
      expect(result).toHaveProperty('performanceTiers');
    });

    it('returns correct values with data', async () => {
      mockPrisma.publishedPost.count.mockResolvedValueOnce(10);
      mockPrisma.publishedPost.aggregate.mockResolvedValueOnce({
        _sum: { impressions: 50000, reach: 30000, likes: 1500, comments: 300, shares: 200, saves: 100, clicks: 400, videoViews: 0 },
        _avg: { engagementRate: 3.5 },
      });
      mockPrisma.publishedPost.groupBy.mockResolvedValueOnce([
        { performanceTier: 'TOP', _count: 3 },
      ]);

      const result = await service.getOverview(USER_ID);

      expect(result.totalPosts).toBe(10);
      expect(Number(result.avgEngagementRate)).toBeCloseTo(3.5);
      expect(result.totals.impressions).toBe(50000);
    });
  });

  describe('getTimeSeries', () => {
    it('returns empty array when no data', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getTimeSeries(USER_ID, undefined, 7);
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns time series rows', async () => {
      const rows = [{ date: '2025-01-15', posts: 2, avg_engagement: 3.0, total_impressions: 1500 }];
      mockPrisma.$queryRaw.mockResolvedValue(rows);

      const result = await service.getTimeSeries(USER_ID, undefined, 7);
      // result is the return value of the outer $queryRaw call
      expect(result).toBeDefined();
    });
  });

  describe('getPlatformBreakdown', () => {
    it('returns per-platform breakdown', async () => {
      mockPrisma.publishedPost.groupBy.mockResolvedValueOnce([
        { platform: 'instagram', _count: 5, _avg: { engagementRate: 4.5 }, _sum: { impressions: 10000, reach: 8000 } },
        { platform: 'twitter', _count: 3, _avg: { engagementRate: 1.2 }, _sum: { impressions: 3000, reach: 2000 } },
      ]);

      const result = await service.getPlatformBreakdown(USER_ID);
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('platform');
      expect(result[0]).toHaveProperty('avgEngagementRate');
    });
  });

  describe('getTopPosts', () => {
    it('returns top performing posts', async () => {
      mockPrisma.publishedPost.findMany.mockResolvedValueOnce([
        { id: 'p1', platform: 'instagram', platformUrl: 'http://x', publishedAt: new Date(),
          impressions: 20000, reach: 15000, engagementRate: 8.0, performanceTier: 'TOP' },
      ]);

      const result = await service.getTopPosts(USER_ID, undefined, 5);
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('platform');
    });
  });
});
