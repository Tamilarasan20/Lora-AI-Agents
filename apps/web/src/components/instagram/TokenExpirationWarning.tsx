'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface TokenExpirationWarningProps {
  connectionId: string;
  username: string;
  expiresAt: string;
  onRefreshed?: () => void;
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function TokenExpirationWarning({
  connectionId,
  username,
  expiresAt,
  onRefreshed,
}: TokenExpirationWarningProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = daysUntil(expiresAt);
  const isExpired = days === 0 && new Date(expiresAt) < new Date();

  if (done) return null;

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/instagram/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Refresh failed');
        return;
      }
      setDone(true);
      onRefreshed?.();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const severity = isExpired ? 'error' : days < 7 ? 'warning' : 'info';
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  const iconStyles = {
    error: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
  };

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${styles[severity]}`}>
      <svg
        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconStyles[severity]}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">
          {isExpired
            ? `@${username} — Token expired`
            : `@${username} — Token expires in ${days} day${days === 1 ? '' : 's'}`}
        </p>
        <p className="text-xs mt-0.5 opacity-80">
          {isExpired
            ? 'Publishing is paused. Refresh your token to resume.'
            : 'Refresh now to avoid any publishing interruption.'}
        </p>
        {error && <p className="text-xs mt-1 font-medium text-red-700">{error}</p>}
      </div>

      <Button
        size="sm"
        variant={severity === 'error' ? 'danger' : 'outline'}
        onClick={handleRefresh}
        loading={loading}
        className="flex-shrink-0"
      >
        Refresh Token
      </Button>
    </div>
  );
}
