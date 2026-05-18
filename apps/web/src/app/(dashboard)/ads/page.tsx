'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdAccountCard, AdAccountData } from '@/components/ads/AdAccountCard';
import { CampaignList, CampaignData } from '@/components/ads/CampaignList';
import { AdInsightsDashboard } from '@/components/ads/AdInsightsDashboard';
import { Button } from '@/components/ui/Button';

export default function AdsPage() {
  const [accounts, setAccounts] = useState<AdAccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Selected account state
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [insightsAccountId, setInsightsAccountId] = useState<string | null>(null);

  // Campaign state
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  // Create campaign modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createObjective, setCreateObjective] = useState('AWARENESS');
  const [createBudget, setCreateBudget] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ads/accounts');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to load ad accounts');
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

  const fetchCampaigns = useCallback(async (accountId: string) => {
    setCampaignsLoading(true);
    try {
      const res = await fetch(`/api/ads/accounts/${accountId}/campaigns`);
      if (!res.ok) return;
      const data = await res.json();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (selectedAccountId) {
      fetchCampaigns(selectedAccountId);
    } else {
      setCampaigns([]);
    }
  }, [selectedAccountId, fetchCampaigns]);

  async function handleStatusChange(campaignId: string, status: 'ACTIVE' | 'PAUSED') {
    const res = await fetch(`/api/ads/campaigns/${campaignId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok && selectedAccountId) {
      await fetchCampaigns(selectedAccountId);
    }
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAccountId) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/ads/accounts/${selectedAccountId}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName,
          objective: createObjective,
          dailyBudget: createBudget ? Number(createBudget) : undefined,
        }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setCreateName('');
        setCreateBudget('');
        setBanner({ type: 'success', message: 'Campaign created successfully!' });
        setTimeout(() => setBanner(null), 5000);
        await fetchCampaigns(selectedAccountId);
      } else {
        const body = await res.json().catch(() => ({}));
        setBanner({ type: 'error', message: body.error ?? 'Failed to create campaign' });
        setTimeout(() => setBanner(null), 5000);
      }
    } finally {
      setCreating(false);
    }
  }

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const insightsAccount = accounts.find((a) => a.id === insightsAccountId);

  const OBJECTIVES = [
    'AWARENESS', 'REACH', 'TRAFFIC', 'ENGAGEMENT', 'APP_INSTALLS',
    'VIDEO_VIEWS', 'LEAD_GENERATION', 'CONVERSIONS', 'CATALOG_SALES', 'STORE_TRAFFIC',
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meta Ads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your Meta ad accounts, campaigns, and view performance insights. Ad accounts are auto-discovered during Meta OAuth.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (window.location.href = '/api/auth/meta/login')}
        >
          Connect Meta Account
        </Button>
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
          <p className="text-sm font-medium flex-1">{banner.message}</p>
          <button onClick={() => setBanner(null)} className="opacity-60 hover:opacity-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700 mb-3">{error}</p>
          <button onClick={fetchAccounts} className="text-sm text-red-600 underline hover:text-red-700">
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && accounts.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No ad accounts found</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Connect your Meta account and ad accounts will be automatically discovered.
          </p>
          <Button variant="primary" onClick={() => (window.location.href = '/api/auth/meta/login')}>
            Connect via Meta OAuth
          </Button>
        </div>
      )}

      {/* Ad account grid */}
      {!loading && !error && accounts.length > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {accounts.map((account) => (
              <AdAccountCard
                key={account.id}
                account={account}
                onViewCampaigns={(id) => {
                  setInsightsAccountId(null);
                  setSelectedAccountId(selectedAccountId === id ? null : id);
                }}
                onViewInsights={(id) => {
                  setSelectedAccountId(null);
                  setInsightsAccountId(insightsAccountId === id ? null : id);
                }}
              />
            ))}
          </div>

          {/* Campaigns panel */}
          {selectedAccount && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Campaigns</h3>
                  <p className="text-sm text-gray-500">{selectedAccount.name}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowCreateModal(true)}>
                    Create Campaign
                  </Button>
                  <button
                    onClick={() => setSelectedAccountId(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <CampaignList
                campaigns={campaigns}
                onStatusChange={handleStatusChange}
                loading={campaignsLoading}
              />
            </div>
          )}

          {/* Insights panel */}
          {insightsAccount && (
            <AdInsightsDashboard
              adAccountId={insightsAccount.id}
              accountName={insightsAccount.name}
            />
          )}
        </div>
      )}

      {/* Create campaign modal */}
      {showCreateModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Create Campaign</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="My Campaign"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Objective *</label>
                <select
                  value={createObjective}
                  onChange={(e) => setCreateObjective(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {OBJECTIVES.map((obj) => (
                    <option key={obj} value={obj}>{obj.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Daily Budget (USD)</label>
                <input
                  type="number"
                  value={createBudget}
                  onChange={(e) => setCreateBudget(e.target.value)}
                  placeholder="10.00"
                  min="1"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-gray-400">Leave empty for lifetime budget</p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" loading={creating} className="flex-1">
                  {creating ? 'Creating…' : 'Create Campaign'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
