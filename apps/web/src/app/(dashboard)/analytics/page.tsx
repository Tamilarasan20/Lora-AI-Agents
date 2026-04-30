'use client';
import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { useAnalyticsSummary, useAnalyticsTimeSeries, useAnalyticsByPlatform, useTopPosts } from '@/lib/hooks/useAnalytics';
import { formatNumber, PLATFORM_COLORS } from '@/lib/utils';

const DAYS_OPTIONS = [7, 14, 30, 90];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [platform, setPlatform] = useState('');

  const summary = useAnalyticsSummary(platform || undefined, days);
  const timeSeries = useAnalyticsTimeSeries(platform || undefined, days);
  const byPlatform = useAnalyticsByPlatform();
  const topPosts = useTopPosts(platform || undefined, 5);

  const chartData = (timeSeries.data ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    engagement: parseFloat((d.avg_engagement ?? 0).toFixed(3)),
    impressions: d.total_impressions ?? 0,
    posts: d.posts ?? 0,
  }));

  const platformData = (byPlatform.data ?? []).map((p) => ({
    name: p.platform,
    posts: p.posts,
    engagement: parseFloat(p.avgEngagementRate),
    impressions: p.totalImpressions ?? 0,
  }));

  return (
    <>
      <Header title="Analytics" />
      <div className="flex-1 p-6 space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {DAYS_OPTIONS.map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${days === d ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {d}d
              </button>
            ))}
          </div>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}
            className="pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">All platforms</option>
            {['instagram', 'twitter', 'linkedin', 'tiktok', 'facebook', 'youtube'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Posts published', value: formatNumber(summary.data?.totalPosts ?? 0) },
            { label: 'Avg engagement rate', value: `${summary.data?.avgEngagementRate ?? 0}%` },
            { label: 'Total impressions', value: formatNumber(summary.data?.totals?.impressions ?? 0) },
            { label: 'Total likes', value: formatNumber(summary.data?.totals?.likes ?? 0) },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="py-4">
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Engagement over time */}
          <Card className="col-span-2">
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Engagement rate over time</h2>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f5eff" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#4f5eff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Area type="monotone" dataKey="engagement" stroke="#4f5eff" fill="url(#grad1)" strokeWidth={2} dot={false} name="Engagement %" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Platform breakdown */}
          <Card>
            <CardHeader><h2 className="font-semibold text-gray-900">Posts by platform</h2></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={platformData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} tickLine={false} width={80} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="posts" radius={[0, 4, 4, 0]}>
                    {platformData.map((p) => (
                      <Cell key={p.name} fill={PLATFORM_COLORS[p.name] ?? '#4f5eff'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Engagement by platform */}
          <Card>
            <CardHeader><h2 className="font-semibold text-gray-900">Avg engagement by platform</h2></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={platformData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} tickLine={false} width={80} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v}%`, 'Engagement']} />
                  <Bar dataKey="engagement" radius={[0, 4, 4, 0]}>
                    {platformData.map((p) => (
                      <Cell key={p.name} fill={PLATFORM_COLORS[p.name] ?? '#4f5eff'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
