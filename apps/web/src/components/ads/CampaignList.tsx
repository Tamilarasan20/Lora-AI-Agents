'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export interface CampaignData {
  id: string;
  fbCampaignId: string;
  name: string;
  objective: string;
  status: string;
  dailyBudget?: string | number | null;
  _count?: { adSets: number };
}

interface CampaignListProps {
  campaigns: CampaignData[];
  onStatusChange?: (campaignId: string, status: 'ACTIVE' | 'PAUSED') => Promise<void>;
  loading?: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    PAUSED: 'bg-yellow-100 text-yellow-700',
    DELETED: 'bg-gray-100 text-gray-500',
    ARCHIVED: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export function CampaignList({ campaigns, onStatusChange, loading }: CampaignListProps) {
  const [toggling, setToggling] = useState<string | null>(null);

  async function handleToggle(campaign: CampaignData) {
    const newStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setToggling(campaign.id);
    try {
      await onStatusChange?.(campaign.id, newStatus);
    } finally {
      setToggling(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        No campaigns found. Create one or sync from Meta.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Objective</th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Daily Budget</th>
            <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ad Sets</th>
            <th className="py-2 px-3" />
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="py-2.5 px-3">
                <p className="font-medium text-gray-900 truncate max-w-[180px]">{campaign.name}</p>
              </td>
              <td className="py-2.5 px-3">
                <span className="text-xs text-gray-500">{campaign.objective}</span>
              </td>
              <td className="py-2.5 px-3">
                <StatusBadge status={campaign.status} />
              </td>
              <td className="py-2.5 px-3 text-right text-gray-700">
                {campaign.dailyBudget != null
                  ? `$${Number(campaign.dailyBudget).toFixed(2)}`
                  : <span className="text-gray-400">—</span>}
              </td>
              <td className="py-2.5 px-3 text-center text-gray-600">
                {campaign._count?.adSets ?? 0}
              </td>
              <td className="py-2.5 px-3">
                {campaign.status !== 'DELETED' && campaign.status !== 'ARCHIVED' && (
                  <Button
                    size="sm"
                    variant={campaign.status === 'ACTIVE' ? 'outline' : 'primary'}
                    loading={toggling === campaign.id}
                    onClick={() => handleToggle(campaign)}
                    className="text-xs"
                  >
                    {campaign.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
