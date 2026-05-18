'use client';

import { useEffect, useState } from 'react';

interface AccountInsights {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  cpm: number;
  cpc: number;
  ctr: number;
  conversions: number;
  dateStart?: string;
  dateStop?: string;
}

interface CampaignInsightRow {
  campaignId?: string;
  campaignName?: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  ctr: number;
  cpc: number;
}

type DatePreset = 'last_7d' | 'last_30d' | 'last_90d';

interface AdInsightsDashboardProps {
  adAccountId: string;
  accountName: string;
}

function formatCurrency(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

export function AdInsightsDashboard({ adAccountId, accountName }: AdInsightsDashboardProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>('last_30d');
  const [accountInsights, setAccountInsights] = useState<AccountInsights | null>(null);
  const [campaignInsights, setCampaignInsights] = useState<CampaignInsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/ads/accounts/${adAccountId}/insights?datePreset=${datePreset}`).then((r) => r.json()),
      fetch(`/api/ads/accounts/${adAccountId}/campaigns/insights?datePreset=${datePreset}`)
        .then((r) => r.json())
        .catch(() => []),
    ])
      .then(([acct, campaigns]) => {
        if (cancelled) return;
        setAccountInsights(acct);
        setCampaignInsights(Array.isArray(campaigns) ? campaigns : []);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load ad insights');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [adAccountId, datePreset]);

  const summaryMetrics = accountInsights
    ? [
        { label: 'Total Spend', value: formatCurrency(accountInsights.spend), icon: '$' },
        { label: 'Impressions', value: formatNumber(accountInsights.impressions), icon: 'i' },
        { label: 'Clicks', value: formatNumber(accountInsights.clicks), icon: 'c' },
        { label: 'Reach', value: formatNumber(accountInsights.reach), icon: 'r' },
        { label: 'CTR', value: formatPct(accountInsights.ctr / 100), icon: '%' },
        { label: 'CPC', value: formatCurrency(accountInsights.cpc), icon: '$' },
        { label: 'CPM', value: formatCurrency(accountInsights.cpm), icon: '$' },
        { label: 'Conversions', value: formatNumber(accountInsights.conversions), icon: 'v' },
      ]
    : [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Ad Insights</h3>
          <p className="text-sm text-gray-500">{accountName}</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {([
            { value: 'last_7d', label: 'Last 7d' },
            { value: 'last_30d', label: 'Last 30d' },
            { value: 'last_90d', label: 'Last 90d' },
          ] as { value: DatePreset; label: string }[]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDatePreset(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                datePreset === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {!loading && !error && accountInsights && (
        <>
          {/* Summary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {summaryMetrics.map((m) => (
              <div key={m.label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">{m.label}</p>
                <p className="text-lg font-bold text-gray-900">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Campaign breakdown */}
          {campaignInsights.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Campaign Breakdown</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Spend</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Impr.</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Clicks</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">CTR</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">CPC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignInsights.map((row, i) => (
                      <tr key={row.campaignId ?? i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 text-gray-800 truncate max-w-[160px]">
                          {row.campaignName ?? row.campaignId ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-right text-gray-700">{formatCurrency(row.spend)}</td>
                        <td className="py-2 px-2 text-right text-gray-700">{formatNumber(row.impressions)}</td>
                        <td className="py-2 px-2 text-right text-gray-700">{formatNumber(row.clicks)}</td>
                        <td className="py-2 px-2 text-right text-gray-700">{(row.ctr * 100).toFixed(2)}%</td>
                        <td className="py-2 px-2 text-right text-gray-700">{formatCurrency(row.cpc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
