'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

type PostType = 'IMAGE' | 'CAROUSEL' | 'REEL';

interface SchedulePostModalProps {
  accountId: string;
  accountUsername: string;
  onClose: () => void;
  onSuccess?: (result: { scheduledPostId: string; jobId: string; scheduledAt: string }) => void;
}

export function SchedulePostModal({
  accountId,
  accountUsername,
  onClose,
  onSuccess,
}: SchedulePostModalProps) {
  const [type, setType] = useState<PostType>('IMAGE');
  const [caption, setCaption] = useState('');
  const [mediaUrls, setMediaUrls] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ scheduledPostId: string; jobId: string; scheduledAt: string } | null>(null);

  // Default to 1 hour from now for the datetime picker
  const minDateTime = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const urls = mediaUrls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      setError('Please provide at least one media URL');
      return;
    }
    if (type === 'CAROUSEL' && urls.length < 2) {
      setError('Carousel requires at least 2 media items');
      return;
    }
    if (!scheduledAt) {
      setError('Please select a publish date and time');
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      setError('Scheduled time must be in the future');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/instagram/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          igAccountDbId: accountId,
          type,
          caption: caption.trim() || undefined,
          mediaUrls: urls,
          scheduledAt: scheduledDate.toISOString(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Scheduling failed');
        return;
      }

      const result = { ...data, scheduledAt: scheduledDate.toISOString() };
      setSuccess(result);
      onSuccess?.(result);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    const when = new Date(success.scheduledAt);
    return (
      <ModalWrapper onClose={onClose}>
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Post Scheduled!</h3>
          <p className="text-sm text-gray-500 mb-1">
            Will publish on{' '}
            <span className="font-medium text-gray-700">
              {when.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </p>
          <p className="text-sm text-gray-500 mb-4">
            at{' '}
            <span className="font-medium text-gray-700">
              {when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>Done</Button>
        </div>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Schedule for @{accountUsername}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Post type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Post Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(['IMAGE', 'CAROUSEL', 'REEL'] as PostType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-2 text-sm font-medium rounded-lg border transition-colors ${
                  type === t
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule date/time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Publish Date & Time</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            min={minDateTime}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="mt-1 text-xs text-gray-400">Times are in your local timezone</p>
        </div>

        {/* Media URLs */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Media URL{type === 'CAROUSEL' ? 's' : ''}
            {type === 'CAROUSEL' && <span className="text-gray-400 ml-1">(one per line)</span>}
          </label>
          <textarea
            value={mediaUrls}
            onChange={(e) => setMediaUrls(e.target.value)}
            placeholder={
              type === 'CAROUSEL'
                ? 'https://cdn.example.com/image1.jpg\nhttps://cdn.example.com/image2.jpg'
                : type === 'REEL'
                ? 'https://cdn.example.com/video.mp4'
                : 'https://cdn.example.com/image.jpg'
            }
            rows={type === 'CAROUSEL' ? 4 : 2}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>

        {/* Caption */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium text-gray-700">Caption</label>
            <span className={`text-xs ${caption.length > 2200 ? 'text-red-500' : 'text-gray-400'}`}>
              {caption.length}/2200
            </span>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write your caption... #hashtags @mentions"
            rows={4}
            maxLength={2200}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" size="md" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" loading={loading} className="flex-1">
            {loading ? 'Scheduling…' : 'Schedule Post'}
          </Button>
        </div>
      </form>
    </ModalWrapper>
  );
}

function ModalWrapper({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
