'use client';

import { useState } from 'react';
import { useLoraCalendar, useScheduleCalendarItem } from '@/lib/hooks/useLora';
import type { CalendarItem } from '@/lib/hooks/useLora';

const PLATFORM_ICONS: Record<string, string> = {
  Instagram: '📸', TikTok: '🎵', Facebook: '👥', LinkedIn: '💼',
  X: '𝕏', Pinterest: '📌', YouTube: '▶️',
};

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-600',
};

const BEST_TIMES: Record<string, string[]> = {
  Instagram: ['09:00', '12:00', '17:00', '20:00'],
  TikTok:    ['07:00', '14:00', '19:00', '21:00'],
  Facebook:  ['09:00', '13:00', '15:00', '19:00'],
  LinkedIn:  ['08:00', '10:00', '12:00', '17:00'],
  X:         ['08:00', '12:00', '17:00', '20:00'],
  Pinterest: ['08:00', '14:00', '21:00'],
  YouTube:   ['15:00', '17:00', '20:00'],
};

export default function CalendarPage() {
  const now = new Date();
  const [from] = useState(() => now.toISOString());
  const [to] = useState(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + 30);
    return d.toISOString();
  });
  const [scheduling, setScheduling] = useState<CalendarItem | null>(null);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');

  const { data: items = [], isLoading, refetch } = useLoraCalendar(from, to);
  const schedMutation = useScheduleCalendarItem();

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

  const readyToSchedule = items.filter(
    (i) => i.approvalStatus === 'approved' && i.publishStatus === 'draft',
  );

  const handleOpenScheduler = (item: CalendarItem) => {
    setScheduling(item);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSchedDate(tomorrow.toISOString().split('T')[0]);
    const suggested = BEST_TIMES[item.platform]?.[0] ?? '10:00';
    setSchedTime(suggested);
  };

  const handleSchedule = async () => {
    if (!scheduling) return;
    const scheduledAt = schedDate && schedTime ? new Date(`${schedDate}T${schedTime}`).toISOString() : undefined;
    await schedMutation.mutateAsync({ itemId: scheduling.id, scheduledAt });
    setScheduling(null);
    refetch();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Marketing Calendar</h1>
          <p className="text-sm text-gray-500">Next 30 days · {items.length} items scheduled</p>
        </div>
        {readyToSchedule.length > 0 && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
            <span className="text-sm">📅</span>
            <span className="text-sm font-medium text-green-700">{readyToSchedule.length} ready to schedule</span>
          </div>
        )}
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

      {/* Sarah's ready-to-schedule banner */}
      {readyToSchedule.length > 0 && (
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📅</span>
            <span className="text-sm font-semibold text-violet-800">Sarah says: ready to schedule</span>
          </div>
          <div className="space-y-2">
            {readyToSchedule.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-violet-100">
                <div className="flex items-center gap-2">
                  <span>{PLATFORM_ICONS[item.platform] ?? '📱'}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{item.title}</div>
                    <div className="text-xs text-gray-400">{item.platform} · {item.contentType}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenScheduler(item)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700"
                >
                  Schedule
                </button>
              </div>
            ))}
          </div>
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
                  <CalendarCard
                    key={item.id}
                    item={item}
                    onSchedule={() => handleOpenScheduler(item)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Modal */}
      {scheduling && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">📅</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">Schedule post</div>
                <div className="text-xs text-gray-500">{scheduling.platform} · {scheduling.contentType}</div>
              </div>
              <button onClick={() => setScheduling(null)} className="ml-auto text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="bg-gray-50 rounded-xl px-4 py-2 mb-4">
              <p className="text-sm font-medium text-gray-700">{scheduling.title}</p>
            </div>

            {/* Best time suggestions */}
            {BEST_TIMES[scheduling.platform] && (
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2">Sarah's best times for {scheduling.platform}</div>
                <div className="flex gap-2 flex-wrap">
                  {BEST_TIMES[scheduling.platform].map((t) => (
                    <button
                      key={t}
                      onClick={() => setSchedTime(t)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        schedTime === t
                          ? 'border-violet-400 bg-violet-50 text-violet-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
                <input
                  type="time"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setScheduling(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                disabled={schedMutation.isPending || !schedDate}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {schedMutation.isPending ? 'Scheduling…' : '📅 Schedule post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarCard({ item, onSchedule }: { item: CalendarItem; onSchedule: () => void }) {
  const canSchedule = item.approvalStatus === 'approved' && item.publishStatus === 'draft';

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
        {canSchedule && (
          <button
            onClick={onSchedule}
            className="text-xs px-2.5 py-0.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700"
          >
            Schedule
          </button>
        )}
      </div>
    </div>
  );
}
