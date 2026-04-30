'use client';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, FileText, Send, MessageSquare, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAnalyticsSummary, useAnalyticsTimeSeries } from '@/lib/hooks/useAnalytics';
import { useUnreadCount } from '@/lib/hooks/useEngagement';
import { useContentList } from '@/lib/hooks/useContent';
import { useScheduledPosts } from '@/lib/hooks/useScheduler';
import { formatNumber, formatRelative, STATUS_COLORS } from '@/lib/utils';
import api from '@/lib/api';

function StatCard({
  icon: Icon, label, value, sub, color,
}: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const summary = useAnalyticsSummary(undefined, 30);
  const timeSeries = useAnalyticsTimeSeries(undefined, 14);
  const unread = useUnreadCount();
  const recentContent = useContentList({ limit: 5 });
  const scheduled = useScheduledPosts({ status: 'PENDING' });

  const totalPosts = summary.data?.totalPosts ?? 0;
  const avgEng = summary.data?.avgEngagementRate ?? '0';
  const totalImpressions = summary.data?.totals?.impressions ?? 0;
  const unreadCount = unread.data?.unread ?? 0;

  const chartData = (timeSeries.data ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    engagement: parseFloat((d.avg_engagement ?? 0).toFixed(2)),
    impressions: d.total_impressions ?? 0,
  }));

  return (
    <>
      <Header title="Dashboard" />
      <div className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon={FileText}     label="Posts published (30d)" value={totalPosts}            color="bg-brand-50 text-brand-600" />
          <StatCard icon={TrendingUp}   label="Avg engagement rate"   value={`${avgEng}%`}          color="bg-green-50 text-green-600" />
          <StatCard icon={Send}         label="Total impressions"      value={formatNumber(totalImpressions)} color="bg-purple-50 text-purple-600" />
          <StatCard icon={MessageSquare} label="Unread messages"       value={unreadCount}           color="bg-orange-50 text-orange-600" />
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Engagement trend chart */}
          <Card className="col-span-2">
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Engagement trend (14 days)</h2>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f5eff" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#4f5eff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Area type="monotone" dataKey="engagement" stroke="#4f5eff" fill="url(#engGrad)" strokeWidth={2} dot={false} name="Engagement %" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader><h2 className="font-semibold text-gray-900">Quick actions</h2></CardHeader>
            <CardContent className="space-y-2 py-3">
              {[
                { href: '/content?action=generate', icon: Zap, label: 'Generate with AI', color: 'bg-brand-600 text-white' },
                { href: '/content?action=create',   icon: FileText, label: 'Write manually', color: 'bg-gray-100 text-gray-700' },
                { href: '/calendar',                icon: Send,  label: 'Schedule posts', color: 'bg-gray-100 text-gray-700' },
                { href: '/engagement',              icon: MessageSquare, label: 'View inbox', color: 'bg-gray-100 text-gray-700' },
              ].map((a) => (
                <Link key={a.href} href={a.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 ${a.color}`}>
                  <a.icon className="w-4 h-4" />
                  {a.label}
                  <ArrowRight className="w-3 h-3 ml-auto opacity-60" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Recent content */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Recent content</h2>
              <Link href="/content" className="text-sm text-brand-600 hover:text-brand-700">View all</Link>
            </CardHeader>
            <div className="divide-y divide-gray-50">
              {recentContent.data?.items?.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">No content yet</div>
              ) : (
                recentContent.data?.items?.map((c) => (
                  <Link key={c.id} href={`/content/${c.id}`}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {(c.rawContent as any)?.caption?.slice(0, 60) ?? 'Untitled'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.targetPlatforms.join(', ')} · {formatRelative(c.createdAt)}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {c.status}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </Card>

          {/* Upcoming scheduled */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Upcoming posts</h2>
              <Link href="/calendar" className="text-sm text-brand-600 hover:text-brand-700">View calendar</Link>
            </CardHeader>
            <div className="divide-y divide-gray-50">
              {(scheduled.data?.items?.length ?? 0) === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">No posts scheduled</div>
              ) : (
                scheduled.data?.items?.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-6 py-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold">
                      {p.platform.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 capitalize">{p.platform}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(p.scheduledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Badge variant="info">{p.status}</Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
