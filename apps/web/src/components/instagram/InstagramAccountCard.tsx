'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export interface InstagramAccountData {
  id: string;
  igAccountId: string;
  username: string;
  name?: string;
  profilePictureUrl?: string;
  biography?: string;
  followerCount: number;
  followingCount: number;
  mediaCount: number;
  facebookPageId?: string;
  facebookPageName?: string;
  lastSyncedAt?: string;
  platformConnection?: {
    connectionStatus: string;
    tokenExpiresAt?: string;
  };
}

interface InstagramAccountCardProps {
  account: InstagramAccountData;
  onPublish?: (accountId: string) => void;
  onSchedule?: (accountId: string) => void;
  onRefreshToken?: (accountId: string) => void;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function daysUntilExpiry(expiresAt?: string): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function InstagramAccountCard({
  account,
  onPublish,
  onSchedule,
  onRefreshToken,
}: InstagramAccountCardProps) {
  const [refreshing, setRefreshing] = useState(false);

  const status = account.platformConnection?.connectionStatus ?? 'ACTIVE';
  const daysLeft = daysUntilExpiry(account.platformConnection?.tokenExpiresAt);
  const tokenWarning = daysLeft !== null && daysLeft < 14;
  const isExpired = status === 'EXPIRED' || status === 'REVOKED';

  async function handleRefresh() {
    if (!onRefreshToken) return;
    setRefreshing(true);
    try {
      await onRefreshToken(account.id);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        {account.profilePictureUrl ? (
          <img
            src={account.profilePictureUrl}
            alt={account.username}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-offset-2 ring-pink-400"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
            {account.username[0]?.toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">@{account.username}</p>
          {account.name && (
            <p className="text-sm text-gray-500 truncate">{account.name}</p>
          )}
          {account.facebookPageName && (
            <p className="text-xs text-gray-400 truncate">
              via {account.facebookPageName}
            </p>
          )}
        </div>

        <StatusBadge status={status} />
      </div>

      {/* Stats */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-2 border-b border-gray-100">
        <Stat label="Followers" value={formatNumber(account.followerCount)} />
        <Stat label="Following" value={formatNumber(account.followingCount)} />
        <Stat label="Posts" value={formatNumber(account.mediaCount)} />
      </div>

      {/* Token expiry warning */}
      {(tokenWarning || isExpired) && (
        <div className={`px-4 py-2 flex items-center gap-2 text-sm ${isExpired ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {isExpired
            ? 'Token expired — reconnect Instagram'
            : `Token expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 flex gap-2">
        {!isExpired ? (
          <>
            <Button
              size="sm"
              variant="primary"
              onClick={() => onPublish?.(account.id)}
              className="flex-1"
            >
              Publish Now
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSchedule?.(account.id)}
              className="flex-1"
            >
              Schedule
            </Button>
            {tokenWarning && onRefreshToken && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRefresh}
                loading={refreshing}
              >
                Refresh Token
              </Button>
            )}
          </>
        ) : (
          <Button size="sm" variant="danger" onClick={() => window.location.href = '/api/auth/meta/login'} className="flex-1">
            Reconnect
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: 'Connected', className: 'bg-green-100 text-green-700' },
    EXPIRED: { label: 'Expired', className: 'bg-red-100 text-red-700' },
    REVOKED: { label: 'Revoked', className: 'bg-gray-100 text-gray-600' },
    ERROR: { label: 'Error', className: 'bg-orange-100 text-orange-700' },
  };
  const config = map[status] ?? map['ERROR'];
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.className}`}>
      {config.label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
