'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

type PostType = 'IMAGE' | 'CAROUSEL' | 'REEL';

interface PublishPostModalProps {
  accountId: string;
  accountUsername: string;
  onClose: () => void;
  onSuccess?: (result: { platformPostId: string; platformUrl: string }) => void;
}

export function PublishPostModal({
  accountId,
  accountUsername,
  onClose,
  onSuccess,
}: PublishPostModalProps) {
  const [type, setType] = useState<PostType>('IMAGE');
  const [caption, setCaption] = useState('');
  const [mediaUrls, setMediaUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ platformPostId: string; platformUrl: string } | null>(null);

  const captionLength = caption.length;
  const maxCaption = 2200;

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

    setLoading(true);

    try {
      const res = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          igAccountDbId: accountId,
          type,
          caption: caption.trim() || undefined,
          mediaUrls: urls,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Publish failed');
        return;
      }

      setSuccess(data);
      onSuccess?.(data);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <ModalWrapper onClose={onClose}>
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Published!</h3>
          <p className="text-sm text-gray-500 mb-4">Your post is live on Instagram</p>
          <a
            href={success.platformUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-600 hover:underline"
          >
            View post →
          </a>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          </div>
        </div>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Publish to @{accountUsername}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Post type selector */}
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

        {/* Media URLs */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Media URL{type === 'CAROUSEL' ? 's' : ''}
            {type === 'CAROUSEL' && <span className="text-gray-400 ml-1">(one per line, 2–10)</span>}
          </label>
          <textarea
            value={mediaUrls}
            onChange={(e) => setMediaUrls(e.target.value)}
            placeholder={type === 'CAROUSEL' ? 'https://cdn.example.com/image1.jpg\nhttps://cdn.example.com/image2.jpg' : 'https://cdn.example.com/image.jpg'}
            rows={type === 'CAROUSEL' ? 4 : 2}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
          <p className="mt-1 text-xs text-gray-400">
            {type === 'REEL' ? 'Must be a publicly accessible video URL (MP4)' : 'Must be publicly accessible image URLs (JPEG/PNG)'}
          </p>
        </div>

        {/* Caption */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium text-gray-700">Caption</label>
            <span className={`text-xs ${captionLength > maxCaption ? 'text-red-500' : 'text-gray-400'}`}>
              {captionLength}/{maxCaption}
            </span>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write your caption here... #hashtags @mentions"
            rows={4}
            maxLength={maxCaption}
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
            {loading ? 'Publishing…' : 'Publish Now'}
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
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        {children}
      </div>
    </div>
  );
}
