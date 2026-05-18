'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface ConnectInstagramButtonProps {
  onConnected?: () => void;
  className?: string;
}

export function ConnectInstagramButton({ onConnected, className }: ConnectInstagramButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/meta/login', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to start connection');
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button
        onClick={handleConnect}
        loading={loading}
        className="gap-2"
        variant="primary"
        size="md"
      >
        <InstagramIcon className="w-5 h-5" />
        {loading ? 'Connecting…' : 'Connect Instagram'}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="ig-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="25%" stopColor="#e6683c" />
          <stop offset="50%" stopColor="#dc2743" />
          <stop offset="75%" stopColor="#cc2366" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="url(#ig-gradient)" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
    </svg>
  );
}
