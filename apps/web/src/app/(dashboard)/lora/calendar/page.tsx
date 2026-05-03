'use client';

import { useState } from 'react';
import { useLoraCalendar } from '@/lib/hooks/useLora';
import type { CalendarItem } from '@/lib/hooks/useLora';

const PLATFORM_ICONS: Record<string, string> = {
  Instagram: '📸', TikTok: '🎵', Facebook: '👥', LinkedIn: '💼',
  X: '𝕏', Pinterest: '📌', YouTube: '▶️',
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-600',
};

export default function CalendarPage() {
  const now = new Date();
  const [from] = useState(() => now.toISOString());
  const [to] = useState(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + 30);
    return d.toISOString();
  });

  const { data: items = [], isLoading } = useLoraCalendar(from, to);

  // Group by date
  const grouped = items.reduce<Record<string, CalendarItem[]>>((acc, item) => {
    const key = item.scheduledAt
      ? new Date(item.scheduledAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'Unscheduled';
    acc[key] = [...(acc[key] ?? []), item];
    return acc;
  }, {});

  const platformCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.platform] = (acc[item.platform] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Marketing Calendar</h1>
          <p className="text-sm text-gray-500">Next 30 days · {items.length} items scheduled</p>
        </div>
      </div>

      {/* Platform Summary */}
      {Object.keys(platformCounts).length > 0 && (
        <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
          {Object.entries(platformCounts).map(([platform, count]) => (
            <div
              key={platform}
              className="flex-shrink-0 flex items-center gap-2 bg-white rounded-xl border border-gray-100 px-3 py-2"
            >
              <span>{PLATFORM_ICONS[platform] ?? '📱'}</span>
              <span className="text-sm font-medium text-gray-700">{platform}</span>
              <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-medium">{count}</span>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <div className="h-5 w-32 bg-gray-100 rounded mb-3 animate-pulse" />
              <div className="space-y-2">
                {[...Array(2)].map((_, j) => <div key={j} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
              </div>
            </div>
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="py-20 text-center">
          <div className="text-4xl mb-4">📅</div>
          <h2 className="text-base font-semibold text-gray-800 mb-1">No items scheduled yet</h2>
          <p className="text-sm text-gray-500">Create a strategy and Lora will populate your calendar.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dayItems]) => (
            <div key={date}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{date}</h2>
              <div className="space-y-3">
                {dayItems.map((item) => (
                  <CalendarCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarCard({ item }: { item: CalendarItem }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl flex-shrink-0">
          {PLATFORM_ICONS[item.platform] ?? '📱'}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">{item.title}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{item.platform}</span>
            <span className="text-gray-200">·</span>
            <span className="text-xs text-gray-500">{item.contentType}</span>
            {item.assignedAgent && (
              <>
                <span className="text-gray-200">·</span>
                <span className="text-xs text-gray-500">{item.assignedAgent}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {item.scheduledAt && (
          <span className="text-xs text-gray-400">
            {new Date(item.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[item.publishStatus] ?? 'bg-gray-100 text-gray-600'}`}>
          {item.publishStatus}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${item.approvalStatus === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {item.approvalStatus}
        </span>
      </div>
    </div>
  );
}
