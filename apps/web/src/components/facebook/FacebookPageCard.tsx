'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export interface FacebookPageData {
  id: string;
  pageId: string;
  name: string;
  category?: string;
  pictureUrl?: string;
  followerCount: number;
  fanCount: number;
  lastSyncedAt?: string;
  platformConnection?: {
    connectionStatus: string;
  };
}

interface FacebookPageCardProps {
  page: FacebookPageData;
  onPublish?: (pageId: string) => void;
  onSchedule?: (pageId: string) => void;
  onViewInsights?: (pageId: string) => void;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function FacebookPageCard({ page, onPublish, onSchedule, onViewInsights }: FacebookPageCardProps) {
  const status = page.platformConnection?.connectionStatus ?? 'ACTIVE';
  const isExpired = status === 'EXPIRED' || status === 'REVOKED';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        {page.pictureUrl ? (
          <img
            src={page.pictureUrl}
            alt={page.name}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-offset-2 ring-blue-500"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-lg">
            {page.name[0]?.toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{page.name}</p>
          {page.category && (
            <p className="text-sm text-gray-500 truncate">{page.category}</p>
          )}
          <p className="text-xs text-gray-400 truncate">ID: {page.pageId}</p>
        </div>

        <StatusBadge status={status} />
      </div>

      {/* Stats */}
      <div className="px-4 pb-3 grid grid-cols-2 gap-2 border-b border-gray-100">
        <Stat label="Fans" value={formatNumber(page.fanCount)} />
        <Stat label="Followers" value={formatNumber(page.followerCount)} />
      </div>

      {/* Expired warning */}
      {isExpired && (
        <div className="px-4 py-2 flex items-center gap-2 text-sm bg-red-50 text-red-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Token expired — reconnect Facebook
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 flex gap-2 flex-wrap">
        {!isExpired ? (
          <>
            <Button size="sm" variant="primary" onClick={() => onPublish?.(page.id)} className="flex-1">
              Publish Now
            </Button>
            <Button size="sm" variant="outline" onClick={() => onSchedule?.(page.id)} className="flex-1">
              Schedule
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onViewInsights?.(page.id)} className="flex-1">
              Insights
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="danger"
            onClick={() => (window.location.href = '/api/auth/meta/login')}
            className="flex-1"
          >
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
