'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

type FbPostType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'LINK';

interface FacebookPublishModalProps {
  pageId: string;
  pageName: string;
  onClose: () => void;
  onSuccess?: (result: { postId: string; type: string }) => void;
}

export function FacebookPublishModal({ pageId, pageName, onClose, onSuccess }: FacebookPublishModalProps) {
  const [type, setType] = useState<FbPostType>('TEXT');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ postId: string; type: string } | null>(null);

  const maxMessage = 63206;
  const requiresMedia = type === 'IMAGE' || type === 'VIDEO';
  const requiresLink = type === 'LINK';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!message.trim() && !requiresMedia) {
      setError('Message is required for TEXT and LINK posts');
      return;
    }
    if (requiresMedia && !mediaUrl.trim()) {
      setError(`A media URL is required for ${type} posts`);
      return;
    }
    if (requiresLink && !link.trim()) {
      setError('A link URL is required for LINK posts');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/facebook/pages/${pageId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message: message.trim() || undefined,
          link: link.trim() || undefined,
          mediaUrls: mediaUrl.trim() ? [mediaUrl.trim()] : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Publish failed');
        return;
      }
      setSuccess(data);
      onSuccess?.(data);
    } catch {
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
          <p className="text-sm text-gray-500 mb-4">Your post is live on Facebook</p>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Publish to {pageName}</h2>
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
          <div className="grid grid-cols-4 gap-2">
            {(['TEXT', 'IMAGE', 'VIDEO', 'LINK'] as FbPostType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                  type === t
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium text-gray-700">
              Message{!requiresMedia ? ' *' : ''}
            </label>
            <span className={`text-xs ${message.length > maxMessage ? 'text-red-500' : 'text-gray-400'}`}>
              {message.length}/{maxMessage}
            </span>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your post message..."
            rows={4}
            maxLength={maxMessage}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Link input for LINK type */}
        {requiresLink && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link URL *</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://example.com/article"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Media URL for IMAGE/VIDEO */}
        {requiresMedia && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {type === 'IMAGE' ? 'Image URL *' : 'Video URL *'}
            </label>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder={
                type === 'IMAGE'
                  ? 'https://cdn.example.com/image.jpg'
                  : 'https://cdn.example.com/video.mp4'
              }
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">Must be a publicly accessible URL</p>
          </div>
        )}

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
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
