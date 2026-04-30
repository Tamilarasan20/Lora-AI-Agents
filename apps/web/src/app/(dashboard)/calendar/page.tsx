'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, Plus, X, Zap } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useScheduledPosts, useSchedulePost, useScheduleWithAI, useCancelScheduled } from '@/lib/hooks/useScheduler';
import { useContentList } from '@/lib/hooks/useContent';
import { PLATFORM_ICONS, STATUS_COLORS, formatDate } from '@/lib/utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const today = new Date();
  const [viewDate, setViewDate] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const startDate = new Date(viewDate.year, viewDate.month, 1).toISOString();
  const endDate = new Date(viewDate.year, viewDate.month + 1, 0, 23, 59, 59).toISOString();

  const { data: scheduledData, isLoading } = useScheduledPosts({ startDate, endDate });
  const cancelScheduled = useCancelScheduled();

  const daysInMonth = getDaysInMonth(viewDate.year, viewDate.month);
  const firstDay = getFirstDayOfMonth(viewDate.year, viewDate.month);

  const prevMonth = () => setViewDate((v) => {
    const d = new Date(v.year, v.month - 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const nextMonth = () => setViewDate((v) => {
    const d = new Date(v.year, v.month + 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const postsByDay: Record<number, any[]> = {};
  (scheduledData?.items ?? []).forEach((post: any) => {
    const d = new Date(post.scheduledFor);
    if (d.getFullYear() === viewDate.year && d.getMonth() === viewDate.month) {
      const day = d.getDate();
      if (!postsByDay[day]) postsByDay[day] = [];
      postsByDay[day].push(post);
    }
  });

  const selectedPosts = selectedDay ? (postsByDay[selectedDay] ?? []) : [];
  const selectedDate = selectedDay
    ? new Date(viewDate.year, viewDate.month, selectedDay)
    : null;

  return (
    <>
      <Header title="Content Calendar" />
      <div className="flex-1 p-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Calendar grid */}
          <div className="col-span-2">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="w-5 h-5 text-gray-500" />
                </button>
                <h2 className="font-semibold text-gray-900">
                  {MONTHS[viewDate.month]} {viewDate.year}
                </h2>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </button>
              </CardHeader>
              <CardContent>
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                  {DAYS.map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-gray-400 py-2">{d}</div>
                  ))}
                </div>

                {/* Calendar cells */}
                <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="bg-white h-24" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isToday = day === today.getDate() && viewDate.month === today.getMonth() && viewDate.year === today.getFullYear();
                    const isSelected = day === selectedDay;
                    const posts = postsByDay[day] ?? [];

                    return (
                      <div
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className={`bg-white h-24 p-2 cursor-pointer transition-colors hover:bg-gray-50 ${isSelected ? 'ring-2 ring-inset ring-brand-500' : ''}`}
                      >
                        <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1 ${isToday ? 'bg-brand-600 text-white' : 'text-gray-700'}`}>
                          {day}
                        </div>
                        <div className="space-y-0.5">
                          {posts.slice(0, 3).map((post: any, idx: number) => (
                            <div key={idx} className="text-xs truncate px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 font-medium">
                              {PLATFORM_ICONS[post.platform] ?? '🌐'} {new Date(post.scheduledFor).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          ))}
                          {posts.length > 3 && (
                            <div className="text-xs text-gray-400 px-1">+{posts.length - 3} more</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Day detail */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {selectedDate
                  ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                  : 'Select a day'}
              </h3>
              <Button size="sm" onClick={() => setShowScheduleModal(true)}>
                <Plus className="w-3.5 h-3.5" /> Schedule
              </Button>
            </div>

            {selectedPosts.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No posts scheduled</p>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="mt-3 text-sm text-brand-600 hover:underline"
                  >
                    + Add post
                  </button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {selectedPosts.map((post: any) => (
                  <Card key={post.id}>
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xl">{PLATFORM_ICONS[post.platform] ?? '🌐'}</span>
                          <div className="min-w-0">
                            <p className="text-sm text-gray-800 line-clamp-2">
                              {post.content?.rawContent?.caption ?? 'No caption'}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Clock className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {new Date(post.scheduledFor).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[post.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                {post.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        {post.status === 'SCHEDULED' && (
                          <button
                            onClick={() => cancelScheduled.mutate(post.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* AI scheduling suggestion */}
            <Card className="border-brand-100 bg-brand-50/40">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-brand-600" />
                  <span className="text-sm font-medium text-brand-700">AI optimal times</span>
                </div>
                <p className="text-xs text-gray-500">
                  Best posting windows for your audience: <strong>9am–11am</strong> and <strong>6pm–8pm</strong> on weekdays.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showScheduleModal && (
        <ScheduleModal
          onClose={() => setShowScheduleModal(false)}
          defaultDate={selectedDate ?? new Date()}
        />
      )}
    </>
  );
}

function ScheduleModal({ onClose, defaultDate }: { onClose: () => void; defaultDate: Date }) {
  const [contentId, setContentId] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [scheduledFor, setScheduledFor] = useState(
    new Date(defaultDate.setHours(10, 0, 0, 0)).toISOString().slice(0, 16)
  );
  const [useAI, setUseAI] = useState(false);

  const { data: contentData } = useContentList({ status: 'APPROVED', limit: 50 });
  const schedulePost = useSchedulePost();
  const scheduleWithAI = useScheduleWithAI();

  const handleSubmit = async () => {
    if (!contentId) return;
    if (useAI) {
      await scheduleWithAI.mutateAsync({ contentId, platform });
    } else {
      await schedulePost.mutateAsync({ contentId, platform, scheduledFor: new Date(scheduledFor).toISOString() });
    }
    onClose();
  };

  const isPending = schedulePost.isPending || scheduleWithAI.isPending;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Schedule post</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <select
              value={contentId}
              onChange={(e) => setContentId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select approved content…</option>
              {(contentData?.items ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {(c.rawContent as any)?.caption?.slice(0, 60) ?? 'Untitled'}…
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {['instagram', 'twitter', 'linkedin', 'tiktok', 'facebook', 'youtube'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 p-3 bg-brand-50 rounded-lg">
            <input
              type="checkbox"
              id="useAI"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
              className="w-4 h-4 accent-brand-600"
            />
            <label htmlFor="useAI" className="text-sm text-brand-700 font-medium cursor-pointer">
              <Zap className="w-3.5 h-3.5 inline mr-1" />
              Let Mark AI pick the optimal time
            </label>
          </div>

          {!useAI && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date & time</label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSubmit} loading={isPending} disabled={!contentId}>
              {useAI ? <><Zap className="w-4 h-4" /> AI Schedule</> : <><Clock className="w-4 h-4" /> Schedule</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
