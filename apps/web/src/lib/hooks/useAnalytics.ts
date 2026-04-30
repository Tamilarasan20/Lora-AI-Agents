'use client';
import { useQuery } from '@tanstack/react-query';
import api from '../api';

export function useAnalyticsSummary(platform?: string, days = 30) {
  return useQuery({
    queryKey: ['analytics', 'summary', platform, days],
    queryFn: async () => {
      const { data } = await api.get('/analytics/summary', { params: { platform, days } });
      return data as {
        totalPosts: number;
        totals: Record<string, number>;
        avgEngagementRate: string;
        performanceTiers: Record<string, number>;
      };
    },
  });
}

export function useAnalyticsTimeSeries(platform?: string, days = 30) {
  return useQuery({
    queryKey: ['analytics', 'timeseries', platform, days],
    queryFn: async () => {
      const { data } = await api.get<Array<{
        date: string; posts: number; avg_engagement: number; total_impressions: number;
      }>>('/analytics/time-series', { params: { platform, days } });
      return data;
    },
  });
}

export function useAnalyticsByPlatform() {
  return useQuery({
    queryKey: ['analytics', 'platforms'],
    queryFn: async () => {
      const { data } = await api.get<Array<{
        platform: string; posts: number; avgEngagementRate: string;
        totalImpressions: number; totalReach: number;
      }>>('/analytics/by-platform');
      return data;
    },
  });
}

export function usePostPerformance(opts?: {
  platform?: string; page?: number; limit?: number; sortBy?: string;
}) {
  return useQuery({
    queryKey: ['analytics', 'posts', opts],
    queryFn: async () => {
      const { data } = await api.get('/analytics/posts', { params: opts });
      return data as { items: unknown[]; total: number; page: number; totalPages: number };
    },
  });
}

export function useTopPosts(platform?: string, limit = 5) {
  return useQuery({
    queryKey: ['analytics', 'top-posts', platform, limit],
    queryFn: async () => {
      const { data } = await api.get('/analytics/top-posts', { params: { platform, limit } });
      return data as unknown[];
    },
  });
}
