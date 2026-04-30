'use client';
import { useState } from 'react';
import { MessageSquare, Check, CheckCheck, Send, Filter } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  useEngagementInbox, useApproveReply, useManualReply, useMarkRead,
} from '@/lib/hooks/useEngagement';
import { PLATFORM_ICONS, formatRelative } from '@/lib/utils';

const TYPE_COLORS: Record<string, string> = {
  COMMENT: 'bg-blue-100 text-blue-700',
  DM: 'bg-purple-100 text-purple-700',
  MENTION: 'bg-green-100 text-green-700',
  REPLY: 'bg-orange-100 text-orange-700',
};

export default function EngagementPage() {
  const [filter, setFilter] = useState<{ platform?: string; type?: string; replied?: boolean }>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data, isLoading } = useEngagementInbox({ ...filter, limit: 30 });
  const approveReply = useApproveReply();
  const manualReply = useManualReply();
  const markRead = useMarkRead();

  const handleManualReply = async (id: string) => {
    if (!replyText.trim()) return;
    await manualReply.mutateAsync({ id, replyText });
    setReplyingId(null);
    setReplyText('');
  };

  return (
    <>
      <Header title="Engagement Inbox" />
      <div className="flex-1 p-6">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <select
            value={filter.platform ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, platform: e.target.value || undefined }))}
            className="pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All platforms</option>
            {['instagram', 'twitter', 'linkedin', 'tiktok', 'facebook'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={filter.type ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value || undefined }))}
            className="pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All types</option>
            {['COMMENT', 'DM', 'MENTION', 'REPLY'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            onClick={() => setFilter((f) => ({ ...f, replied: f.replied === false ? undefined : false }))}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${filter.replied === false ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'}`}
          >
            <MessageSquare className="w-4 h-4" /> Unreplied
          </button>
          <span className="ml-auto text-sm text-gray-500">{data?.total ?? 0} items</span>
        </div>

        {/* Inbox list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : data?.items?.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <CheckCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">All caught up!</p>
              <p className="text-sm text-gray-400 mt-1">No engagement items matching your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data?.items?.map((item) => (
              <Card key={item.id} className={!item.isRead ? 'border-brand-200 bg-brand-50/30' : ''}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    {/* Platform icon */}
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                      {PLATFORM_ICONS[item.platform] ?? '🌐'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900">@{item.authorUsername}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[item.type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {item.type}
                        </span>
                        {!item.isRead && <span className="w-2 h-2 rounded-full bg-brand-500" />}
                        <span className="text-xs text-gray-400 ml-auto">{formatRelative(item.engagementCreatedAt)}</span>
                      </div>

                      <p className="text-sm text-gray-700 mb-2">{item.text}</p>

                      {/* AI draft reply */}
                      {item.replyText && !item.replied && (
                        <div className="bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 mb-2">
                          <p className="text-xs text-brand-600 font-medium mb-1">Sarah's suggested reply:</p>
                          <p className="text-sm text-gray-700">{item.replyText}</p>
                        </div>
                      )}

                      {/* Replied status */}
                      {item.replied && (
                        <div className="flex items-center gap-1.5 text-xs text-green-600">
                          <Check className="w-3 h-3" />
                          Replied {item.repliedBy === 'AI' ? 'by Sarah AI' : 'manually'} {item.repliedAt ? formatRelative(item.repliedAt) : ''}
                        </div>
                      )}

                      {/* Manual reply box */}
                      {replyingId === item.id && (
                        <div className="flex gap-2 mt-2">
                          <input
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Type your reply…"
                            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                            onKeyDown={(e) => e.key === 'Enter' && handleManualReply(item.id)}
                          />
                          <Button size="sm" onClick={() => handleManualReply(item.id)} loading={manualReply.isPending}>
                            <Send className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setReplyingId(null)}>Cancel</Button>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {!item.replied && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.replyText && (
                          <Button size="sm" onClick={() => approveReply.mutate(item.id)} loading={approveReply.isPending}>
                            <Check className="w-3 h-3" /> Approve
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => {
                          setReplyingId(item.id);
                          markRead.mutate(item.id);
                        }}>
                          Reply
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
