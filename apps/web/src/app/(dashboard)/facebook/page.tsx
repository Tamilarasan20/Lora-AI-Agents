'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FacebookPageCard, FacebookPageData } from '@/components/facebook/FacebookPageCard';
import { FacebookPublishModal } from '@/components/facebook/FacebookPublishModal';
import { FacebookScheduleModal } from '@/components/facebook/FacebookScheduleModal';
import { FacebookPageInsights } from '@/components/facebook/FacebookPageInsights';
import { Button } from '@/components/ui/Button';

export default function FacebookPage() {
  const searchParams = useSearchParams();
  const [pages, setPages] = useState<FacebookPageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal / panel state
  const [publishTarget, setPublishTarget] = useState<FacebookPageData | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<FacebookPageData | null>(null);
  const [insightsTarget, setInsightsTarget] = useState<FacebookPageData | null>(null);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/facebook/pages');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to load Facebook Pages');
        return;
      }
      const data = await res.json();
      setPages(Array.isArray(data) ? data : []);
    } catch {
      setError('Network error. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  // Handle OAuth callback
  useEffect(() => {
    const connected = searchParams.get('connected');
    const oauthError = searchParams.get('error');
    if (connected === 'true') {
      setBanner({ type: 'success', message: 'Facebook connected! Pages have been synced.' });
      setTimeout(() => setBanner(null), 6000);
    } else if (oauthError) {
      setBanner({ type: 'error', message: decodeURIComponent(oauthError) });
      setTimeout(() => setBanner(null), 8000);
    }
  }, [searchParams]);

  const activePages = pages.filter(
    (p) => p.platformConnection?.connectionStatus === 'ACTIVE',
  );

  const totalFollowers = pages.reduce((sum, p) => sum + (p.followerCount ?? 0), 0);

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facebook Pages</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your Facebook Pages and publish content. Pages are auto-synced when you connect via Meta OAuth.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (window.location.href = '/api/auth/meta/login')}
        >
          Connect Facebook
        </Button>
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={`mb-6 rounded-xl p-4 flex items-center gap-3 ${
            banner.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <p className="text-sm font-medium flex-1">{banner.message}</p>
          <button onClick={() => setBanner(null)} className="opacity-60 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Stats bar */}
      {pages.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <StatCard label="Connected Pages" value={pages.length} />
          <StatCard label="Active" value={activePages.length} color="green" />
          <StatCard label="Total Followers" value={formatNumber(totalFollowers)} />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700 mb-3">{error}</p>
          <button onClick={fetchPages} className="text-sm text-red-600 underline hover:text-red-700">
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && pages.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No Facebook Pages connected</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Connect your Meta account to automatically sync your Facebook Pages and start publishing content.
          </p>
          <Button variant="primary" onClick={() => (window.location.href = '/api/auth/meta/login')}>
            Connect via Meta OAuth
          </Button>
        </div>
      )}

      {/* Pages grid */}
      {!loading && !error && pages.length > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pages.map((page) => (
              <FacebookPageCard
                key={page.id}
                page={page}
                onPublish={(id) => {
                  const p = pages.find((pg) => pg.id === id)!;
                  setPublishTarget(p);
                }}
                onSchedule={(id) => {
                  const p = pages.find((pg) => pg.id === id)!;
                  setScheduleTarget(p);
                }}
                onViewInsights={(id) => {
                  const p = pages.find((pg) => pg.id === id)!;
                  setInsightsTarget(insightsTarget?.id === id ? null : p);
                }}
              />
            ))}
          </div>

          {/* Inline insights panel */}
          {insightsTarget && (
            <FacebookPageInsights
              pageId={insightsTarget.id}
              pageName={insightsTarget.name}
              onClose={() => setInsightsTarget(null)}
            />
          )}
        </div>
      )}

      {/* Publish modal */}
      {publishTarget && (
        <FacebookPublishModal
          pageId={publishTarget.id}
          pageName={publishTarget.name}
          onClose={() => setPublishTarget(null)}
          onSuccess={() => {
            setPublishTarget(null);
            setBanner({ type: 'success', message: 'Post published successfully!' });
            setTimeout(() => setBanner(null), 5000);
          }}
        />
      )}

      {/* Schedule modal */}
      {scheduleTarget && (
        <FacebookScheduleModal
          pageId={scheduleTarget.id}
          pageName={scheduleTarget.name}
          onClose={() => setScheduleTarget(null)}
          onSuccess={() => {
            setScheduleTarget(null);
            setBanner({ type: 'success', message: 'Post scheduled successfully!' });
            setTimeout(() => setBanner(null), 5000);
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: 'green' | 'orange';
}) {
  const colorMap = {
    green: 'text-green-600',
    orange: 'text-orange-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className={`text-2xl font-bold ${color ? colorMap[color] : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
