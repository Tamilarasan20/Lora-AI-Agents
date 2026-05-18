'use client';

import { useEffect, useState } from 'react';

interface PageInsightsData {
  page: { id: string; name: string };
  insights: {
    page_impressions?: number;
    page_reach?: number;
    page_engaged_users?: number;
    page_fan_count?: number;
    page_post_engagements?: number;
    page_views_total?: number;
  };
  recentPosts: Array<{
    id: string;
    pagePostId?: string;
    message?: string;
    postType: string;
    publishedAt?: string;
    impressions: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
  }>;
}

type DateRange = '7d' | '30d' | '90d';

interface FacebookPageInsightsProps {
  pageId: string;
  pageName: string;
  onClose?: () => void;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function FacebookPageInsights({ pageId, pageName, onClose }: FacebookPageInsightsProps) {
  const [range, setRange] = useState<DateRange>('30d');
  const [data, setData] = useState<PageInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const until = new Date().toISOString();

    fetch(`/api/facebook/pages/${pageId}/insights?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Failed to load insights');
          return;
        }
        const json = await res.json();
        setData(json);
      })
      .catch(() => {
        if (!cancelled) setError('Network error loading insights');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pageId, range]);

  const metrics = data
    ? [
        { label: 'Impressions', value: data.insights.page_impressions ?? 0 },
        { label: 'Reach', value: data.insights.page_reach ?? 0 },
        { label: 'Engaged Users', value: data.insights.page_engaged_users ?? 0 },
        { label: 'Page Views', value: data.insights.page_views_total ?? 0 },
        { label: 'Fan Count', value: data.insights.page_fan_count ?? 0 },
        { label: 'Post Engagements', value: data.insights.page_post_engagements ?? 0 },
      ]
    : [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Page Insights</h3>
          <p className="text-sm text-gray-500">{pageName}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range selector */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['7d', '30d', '90d'] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  range === r ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {r === '7d' ? 'Last 7d' : r === '30d' ? 'Last 30d' : 'Last 90d'}
              </button>
            ))}
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {metrics.map((m) => (
              <div key={m.label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">{m.label}</p>
                <p className="text-xl font-bold text-gray-900">{formatNumber(m.value)}</p>
              </div>
            ))}
          </div>

          {/* Recent posts */}
          {data.recentPosts.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Recent Posts</h4>
              <div className="space-y-2">
                {data.recentPosts.map((post) => (
                  <div key={post.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 shrink-0">
                      {post.postType}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{post.message ?? '(no message)'}</p>
                      {post.publishedAt && (
                        <p className="text-xs text-gray-400">
                          {new Date(post.publishedAt).toLocaleDateString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 text-xs text-gray-500 space-y-0.5">
                      <p>{formatNumber(post.impressions)} impr.</p>
                      <p>{formatNumber(post.likes)} likes</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
