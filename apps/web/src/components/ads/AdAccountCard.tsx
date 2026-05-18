'use client';

import { Button } from '@/components/ui/Button';

export interface AdAccountData {
  id: string;
  fbAccountId: string;
  name: string;
  currency: string;
  timezone: string;
  accountStatus: number;
  isActive: boolean;
  _count?: { campaigns: number };
}

interface AdAccountCardProps {
  account: AdAccountData;
  onViewCampaigns?: (accountId: string) => void;
  onViewInsights?: (accountId: string) => void;
}

function accountStatusLabel(status: number): { label: string; className: string } {
  const map: Record<number, { label: string; className: string }> = {
    1: { label: 'Active', className: 'bg-green-100 text-green-700' },
    2: { label: 'Disabled', className: 'bg-red-100 text-red-700' },
    3: { label: 'Unsettled', className: 'bg-yellow-100 text-yellow-700' },
    7: { label: 'Pending', className: 'bg-blue-100 text-blue-700' },
    9: { label: 'In Grace Period', className: 'bg-orange-100 text-orange-700' },
    101: { label: 'Temporarily Closed', className: 'bg-gray-100 text-gray-700' },
    201: { label: 'Closed', className: 'bg-gray-100 text-gray-600' },
  };
  return map[status] ?? { label: `Status ${status}`, className: 'bg-gray-100 text-gray-600' };
}

export function AdAccountCard({ account, onViewCampaigns, onViewInsights }: AdAccountCardProps) {
  const statusConfig = accountStatusLabel(account.accountStatus);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {account.name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{account.name}</p>
            <p className="text-xs text-gray-400 truncate">
              ID: {account.fbAccountId} &middot; {account.currency} &middot; {account.timezone}
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${statusConfig.className}`}>
          {statusConfig.label}
        </span>
      </div>

      {/* Stats */}
      <div className="px-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>
            <span className="font-semibold text-gray-900">{account._count?.campaigns ?? 0}</span> campaigns
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex gap-2">
        <Button size="sm" variant="primary" onClick={() => onViewCampaigns?.(account.id)} className="flex-1">
          View Campaigns
        </Button>
        <Button size="sm" variant="outline" onClick={() => onViewInsights?.(account.id)} className="flex-1">
          View Insights
        </Button>
      </div>
    </div>
  );
}
