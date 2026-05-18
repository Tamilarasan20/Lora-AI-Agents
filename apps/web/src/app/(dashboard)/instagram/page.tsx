'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConnectInstagramButton } from '@/components/instagram/ConnectInstagramButton';
import { InstagramAccountCard, InstagramAccountData } from '@/components/instagram/InstagramAccountCard';
import { PublishPostModal } from '@/components/instagram/PublishPostModal';
import { SchedulePostModal } from '@/components/instagram/SchedulePostModal';
import { TokenExpirationWarning } from '@/components/instagram/TokenExpirationWarning';

const WARNING_DAYS = 14; // show token warning if < 14 days until expiry

export default function InstagramPage() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<InstagramAccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal state
  const [publishTarget, setPublishTarget] = useState<{ id: string; username: string } | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<{ id: string; username: string } | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/instagram/accounts');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to load accounts');
        return;
      }
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch {
      setError('Network error. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle OAuth callback query params
  useEffect(() => {
    const connected = searchParams.get('connected');
    const oauthError = searchParams.get('error');
    const count = searchParams.get('accounts');

    if (connected === 'true') {
      const n = parseInt(count ?? '0', 10);
      setBanner({
        type: 'success',
        message: `Instagram connected! ${n} business account${n === 1 ? '' : 's'} linked.`,
      });
      setTimeout(() => setBanner(null), 6000);
    } else if (oauthError) {
      setBanner({ type: 'error', message: decodeURIComponent(oauthError) });
      setTimeout(() => setBanner(null), 8000);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  async function handleRefreshToken(accountId: string) {
    const account = accounts.find((a) => a.id === accountId);
    if (!account?.platformConnection) return;

    const res = await fetch('/api/instagram/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: account.platformConnection }),
    });

    if (res.ok) {
      setBanner({ type: 'success', message: 'Token refreshed successfully.' });
      setTimeout(() => setBanner(null), 4000);
      await fetchAccounts();
    }
  }

  // Accounts with expiring tokens (show warnings at top)
  const expiringAccounts = accounts.filter((a) => {
    if (!a.platformConnection?.tokenExpiresAt) return false;
    const days = Math.floor(
      (new Date(a.platformConnection.tokenExpiresAt).getTime() - Date.now()) / 86_400_000,
    );
    return days < WARNING_DAYS;
  });

  const activeAccounts = accounts.filter(
    (a) => a.platformConnection?.connectionStatus === 'ACTIVE',
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instagram</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your Instagram Business accounts and publish content
          </p>
        </div>
        <ConnectInstagramButton onConnected={fetchAccounts} />
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={`mb-6 rounded-xl p-4 flex items-center gap-3 ${
            banner.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            {banner.type === 'success' ? (
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            )}
          </svg>
          <p className="text-sm font-medium">{banner.message}</p>
          <button onClick={() => setBanner(null)} className="ml-auto opacity-60 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Token expiration warnings */}
      {expiringAccounts.length > 0 && (
        <div className="mb-6 space-y-2">
          {expiringAccounts.map((a) => (
            <TokenExpirationWarning
              key={a.id}
              connectionId={a.id}
              username={a.username}
              expiresAt={a.platformConnection!.tokenExpiresAt!}
              onRefreshed={fetchAccounts}
            />
          ))}
        </div>
      )}

      {/* Stats bar */}
      {accounts.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <StatCard label="Connected Accounts" value={accounts.length} />
          <StatCard label="Active" value={activeAccounts.length} color="green" />
          <StatCard
            label="Needs Attention"
            value={expiringAccounts.length}
            color={expiringAccounts.length > 0 ? 'orange' : undefined}
          />
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700 mb-3">{error}</p>
          <button
            onClick={fetchAccounts}
            className="text-sm text-red-600 underline hover:text-red-700"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && accounts.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No Instagram accounts connected</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Connect your Instagram Business account to start publishing and scheduling posts directly from Loraloop.
          </p>
          <ConnectInstagramButton onConnected={fetchAccounts} />
        </div>
      )}

      {/* Account cards grid */}
      {!loading && !error && accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accounts.map((account) => (
            <InstagramAccountCard
              key={account.id}
              account={account}
              onPublish={(id) => {
                const acc = accounts.find((a) => a.id === id)!;
                setPublishTarget({ id, username: acc.username });
              }}
              onSchedule={(id) => {
                const acc = accounts.find((a) => a.id === id)!;
                setScheduleTarget({ id, username: acc.username });
              }}
              onRefreshToken={handleRefreshToken}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {publishTarget && (
        <PublishPostModal
          accountId={publishTarget.id}
          accountUsername={publishTarget.username}
          onClose={() => setPublishTarget(null)}
          onSuccess={() => {
            setPublishTarget(null);
            setBanner({ type: 'success', message: 'Post published successfully!' });
            setTimeout(() => setBanner(null), 5000);
          }}
        />
      )}

      {scheduleTarget && (
        <SchedulePostModal
          accountId={scheduleTarget.id}
          accountUsername={scheduleTarget.username}
          onClose={() => setScheduleTarget(null)}
          onSuccess={() => {
            setScheduleTarget(null);
            setBanner({ type: 'success', message: 'Post scheduled successfully!' });
            setTimeout(() => setBanner(null), 5000);
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: 'green' | 'orange';
}) {
  const colorMap = {
    green: 'text-green-600',
    orange: 'text-orange-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className={`text-2xl font-bold ${color ? colorMap[color] : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
